# Plan: Document Generation Agent

**Doel:** Een web-app waarin je via een chat-interface professionele documenten (voorstellen, rapporten, analyses) laat genereren door een AI agent, met live preview en iteratie.

**Stack:** Next.js 15 (App Router) + Convex + Claude API + Firecrawl API

---

## Architectuur

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                    │
│                                                         │
│  ┌──────────────┐  ┌─────────────────────────────────┐  │
│  │  Chat Panel   │  │     Document Preview Panel      │  │
│  │               │  │                                 │  │
│  │  [Context]    │  │   ┌───────────────────────┐     │  │
│  │  [Messages]   │  │   │                       │     │  │
│  │  [Input]      │  │   │   Live HTML Render    │     │  │
│  │               │  │   │   (iframe sandbox)    │     │  │
│  │               │  │   │                       │     │  │
│  │               │  │   └───────────────────────┘     │  │
│  │               │  │                                 │  │
│  │               │  │   [Download HTML] [Download PDF]│  │
│  └──────────────┘  └─────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────┘
                             │
                    Convex Realtime
                             │
┌────────────────────────────┴────────────────────────────┐
│                   BACKEND (Convex)                       │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐    │
│  │ Projects  │  │ Messages │  │ Documents          │    │
│  │           │  │          │  │ (generated HTML)   │    │
│  └──────────┘  └──────────┘  └────────────────────┘    │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │ generateDocument (Convex Action)                  │   │
│  │                                                   │   │
│  │  1. Pak project context + chat history            │   │
│  │  2. Roep Claude API aan met system prompt         │   │
│  │  3. Stream response terug                         │   │
│  │  4. Sla gegenereerd document op                   │   │
│  │  5. Update UI via realtime                        │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │ scrapeWebsite (Convex Action)                     │   │
│  │                                                   │   │
│  │  Firecrawl API → branding + content extractie     │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Database Schema (Convex)

```typescript
// convex/schema.ts

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  projects: defineTable({
    name: v.string(),
    clientName: v.string(),
    clientWebsite: v.optional(v.string()),
    branding: v.optional(v.object({
      primaryColor: v.string(),
      secondaryColor: v.optional(v.string()),
      accentColor: v.optional(v.string()),
      logoUrl: v.optional(v.string()),
      fonts: v.optional(v.array(v.string())),
    })),
    context: v.string(), // transcript, notes, briefing
    documentType: v.string(), // "voorstel" | "rapport" | "analyse"
  })
    .index("by_name", ["name"]),

  messages: defineTable({
    projectId: v.id("projects"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    documentGenerated: v.optional(v.boolean()),
  })
    .index("by_project", ["projectId"]),

  documents: defineTable({
    projectId: v.id("projects"),
    html: v.string(),
    version: v.number(),
    prompt: v.string(), // what triggered this version
  })
    .index("by_project", ["projectId"])
    .index("by_project_version", ["projectId", "version"]),
});
```

---

## Core Backend: Document Generation Action

```typescript
// convex/documents.ts

import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `Je bent een expert document-generator voor Airflows.
Je genereert professionele, visueel prachtige HTML-documenten.

REGELS:
- Output ALLEEN valide HTML met inline <style> in de <head>
- Gebruik ALTIJD Google Fonts via CDN link
- Kies fonts die passen bij het merk (NOOIT Inter, Roboto, Arial)
- Gebruik de branding kleuren van de klant als die beschikbaar zijn
- Maak het document print-ready (A4)
- Responsive design
- Voeg NOOIT placeholder content toe - alles moet echt en relevant zijn
- Schrijf in de taal die past bij de klant (Nederlands voor NL bedrijven)

DOCUMENT TYPES:
- "voorstel": Projectvoorstel met cover, probleem, aanpak, fases, investering, ROI, CTA
- "rapport": Onderzoeksrapport met samenvatting, bevindingen, conclusies, aanbevelingen
- "analyse": Bedrijfsanalyse met marktcontext, kansen, risicos, roadmap

STYLING RICHTLIJNEN:
- Kies een BOLD aesthetic richting die past bij het merk
- Gebruik CSS custom properties voor kleuren
- Ruime whitespace, duidelijke hierarchie
- Iconen als inline SVG (geen externe dependencies)
- Secties met nummering
- Tabellen voor data, cards voor features
- Gradient of solid backgrounds voor afwisseling
- Cover sectie met logo, titel, datum, metadata

Bij iteratie:
- Pas het HELE document aan, niet alleen het stuk dat gevraagd wordt
- Behoud de styling en structuur tenzij expliciet gevraagd om te wijzigen
- Output altijd het COMPLETE HTML document`;

export const generate = action({
  args: {
    projectId: v.id("projects"),
    userMessage: v.string(),
  },
  handler: async (ctx, { projectId, userMessage }) => {
    // 1. Haal project + history op
    const project = await ctx.runQuery(api.projects.get, { id: projectId });
    if (!project) throw new Error("Project not found");

    const messages = await ctx.runQuery(api.messages.listByProject, { projectId });
    const latestDoc = await ctx.runQuery(api.documents.latest, { projectId });

    // 2. Sla user message op
    await ctx.runMutation(api.messages.send, {
      projectId,
      role: "user",
      content: userMessage,
    });

    // 3. Bouw Claude messages array
    const claudeMessages: Anthropic.MessageParam[] = [];

    // Project context als eerste user message
    let contextMessage = `PROJECT CONTEXT:
Klant: ${project.clientName}
Website: ${project.clientWebsite || "Niet opgegeven"}
Document type: ${project.documentType}
${project.branding ? `Branding: ${JSON.stringify(project.branding)}` : ""}

BRIEFING/TRANSCRIPT:
${project.context}`;

    if (latestDoc) {
      contextMessage += `\n\nHUIDIG DOCUMENT (versie ${latestDoc.version}):\n${latestDoc.html}`;
    }

    claudeMessages.push({ role: "user", content: contextMessage });
    claudeMessages.push({ role: "assistant", content: "Begrepen. Ik heb alle context. Wat wil je dat ik genereer of aanpas?" });

    // Chat history
    for (const msg of messages) {
      claudeMessages.push({ role: msg.role, content: msg.content });
    }

    // Huidige vraag
    claudeMessages.push({ role: "user", content: userMessage });

    // 4. Roep Claude API aan
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: claudeMessages,
    });

    const assistantContent = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    // 5. Extract HTML uit response
    const htmlMatch = assistantContent.match(/<!DOCTYPE html>[\s\S]*<\/html>/i);
    const html = htmlMatch ? htmlMatch[0] : null;
    const textResponse = html
      ? assistantContent.replace(html, "").trim() || "Document is bijgewerkt."
      : assistantContent;

    // 6. Sla response + document op
    await ctx.runMutation(api.messages.send, {
      projectId,
      role: "assistant",
      content: textResponse,
      documentGenerated: !!html,
    });

    if (html) {
      const newVersion = (latestDoc?.version ?? 0) + 1;
      await ctx.runMutation(api.documents.save, {
        projectId,
        html,
        version: newVersion,
        prompt: userMessage,
      });
    }

    return { success: true, hasDocument: !!html };
  },
});
```

---

## Core Backend: Website Scraping

```typescript
// convex/scraping.ts

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

export const scrapeWebsite = action({
  args: {
    projectId: v.id("projects"),
    url: v.string(),
  },
  handler: async (ctx, { projectId, url }) => {
    // Firecrawl API call
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        url,
        formats: ["markdown", "html"],
        onlyMainContent: true,
      }),
    });

    const data = await response.json();

    // Extract branding met Claude
    const brandingResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: `Analyseer deze website HTML en extract de branding:
- primaryColor (hex)
- secondaryColor (hex)
- accentColor (hex)
- logoUrl (absolute URL)
- fonts (array van font namen)

Website URL: ${url}
HTML (eerste 5000 chars): ${data.data?.html?.substring(0, 5000)}

Respond ALLEEN met valid JSON.`,
        }],
      }),
    });

    const brandingData = await brandingResponse.json();
    const brandingText = brandingData.content?.[0]?.text;

    try {
      const branding = JSON.parse(brandingText);
      await ctx.runMutation(api.projects.updateBranding, {
        id: projectId,
        branding,
      });
      return branding;
    } catch {
      return null;
    }
  },
});
```

---

## Frontend: Hoofdpagina

```tsx
// app/project/[id]/page.tsx

"use client";

import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState, useRef, useEffect } from "react";

export default function ProjectPage({ params }: { params: { id: string } }) {
  const projectId = params.id as Id<"projects">;
  const project = useQuery(api.projects.get, { id: projectId });
  const messages = useQuery(api.messages.listByProject, { projectId });
  const latestDoc = useQuery(api.documents.latest, { projectId });
  const generate = useAction(api.documents.generate);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const message = input;
    setInput("");
    setLoading(true);

    try {
      await generate({ projectId, userMessage: message });
    } catch (error) {
      console.error("Generation failed:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!project) return <div className="loading">Laden...</div>;

  return (
    <div className="flex h-screen bg-neutral-950">
      {/* LEFT: Chat Panel */}
      <div className="w-[420px] border-r border-neutral-800 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800">
          <h1 className="text-sm font-semibold text-white">{project.name}</h1>
          <p className="text-xs text-neutral-500">{project.clientName}</p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages?.map((msg) => (
            <div
              key={msg._id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-white text-neutral-900"
                    : "bg-neutral-800 text-neutral-200"
                }`}
              >
                {msg.content}
                {msg.documentGenerated && (
                  <span className="block mt-1.5 text-xs text-emerald-400">
                    ✓ Document bijgewerkt
                  </span>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-400">
                <span className="animate-pulse">Genereren...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-neutral-800">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Genereer een voorstel..."
              className="flex-1 bg-neutral-800 text-white rounded-lg px-3.5 py-2.5 text-sm
                         placeholder:text-neutral-500 outline-none focus:ring-1 focus:ring-neutral-600"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-white text-black rounded-lg px-4 py-2.5 text-sm font-medium
                         disabled:opacity-30 hover:bg-neutral-200 transition-colors"
            >
              Send
            </button>
          </div>
        </form>
      </div>

      {/* RIGHT: Document Preview */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="h-12 border-b border-neutral-800 flex items-center justify-between px-4">
          <span className="text-xs text-neutral-500">
            {latestDoc ? `Versie ${latestDoc.version}` : "Nog geen document"}
          </span>
          <div className="flex gap-2">
            {latestDoc && (
              <>
                <button
                  onClick={() => {
                    const blob = new Blob([latestDoc.html], { type: "text/html" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${project.clientName}-${project.documentType}.html`;
                    a.click();
                  }}
                  className="text-xs text-neutral-400 hover:text-white transition-colors
                             bg-neutral-800 rounded-md px-3 py-1.5"
                >
                  Download HTML
                </button>
                <button
                  onClick={() => {
                    const iframe = document.getElementById("preview") as HTMLIFrameElement;
                    iframe?.contentWindow?.print();
                  }}
                  className="text-xs text-neutral-400 hover:text-white transition-colors
                             bg-neutral-800 rounded-md px-3 py-1.5"
                >
                  Print / PDF
                </button>
              </>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 bg-neutral-900 overflow-auto p-8 flex justify-center">
          {latestDoc ? (
            <iframe
              id="preview"
              srcDoc={latestDoc.html}
              className="w-full max-w-[860px] bg-white rounded-lg shadow-2xl"
              style={{ minHeight: "100%" }}
              sandbox="allow-same-origin allow-popups"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-neutral-600 text-sm">
                Typ een bericht om een document te genereren
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## Setup Instructies

### 1. Project initialiseren

```bash
npx create-next-app@latest document-agent --typescript --tailwind --app --src-dir=false
cd document-agent
npx convex init
```

### 2. Dependencies installeren

```bash
npm install convex @anthropic-ai/sdk
```

### 3. Environment variables

```bash
# .env.local
CONVEX_DEPLOYMENT=dev:xxx
NEXT_PUBLIC_CONVEX_URL=https://xxx.convex.cloud

# In Convex dashboard → Settings → Environment Variables:
# ANTHROPIC_API_KEY=sk-ant-xxx
# FIRECRAWL_API_KEY=fc-xxx
```

### 4. Convex schema deployen

Kopieer het schema uit dit plan naar `convex/schema.ts` en run:

```bash
npx convex dev
```

### 5. Mutations en queries toevoegen

```typescript
// convex/projects.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
  args: {
    name: v.string(),
    clientName: v.string(),
    clientWebsite: v.optional(v.string()),
    context: v.string(),
    documentType: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("projects", args);
  },
});

export const get = query({
  args: { id: v.id("projects") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("projects").order("desc").collect();
  },
});

export const updateBranding = mutation({
  args: {
    id: v.id("projects"),
    branding: v.object({
      primaryColor: v.string(),
      secondaryColor: v.optional(v.string()),
      accentColor: v.optional(v.string()),
      logoUrl: v.optional(v.string()),
      fonts: v.optional(v.array(v.string())),
    }),
  },
  handler: async (ctx, { id, branding }) => {
    await ctx.db.patch(id, { branding });
  },
});
```

```typescript
// convex/messages.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const send = mutation({
  args: {
    projectId: v.id("projects"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    documentGenerated: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", args);
  },
});

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
  },
});
```

```typescript
// convex/documents.ts (queries/mutations, naast de action)
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const save = mutation({
  args: {
    projectId: v.id("projects"),
    html: v.string(),
    version: v.number(),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("documents", args);
  },
});

export const latest = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .first();
    return docs;
  },
});

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    return await ctx.db
      .query("documents")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .collect();
  },
});
```

### 6. Convex provider in layout

```tsx
// app/layout.tsx
import { ConvexClientProvider } from "@/components/convex-provider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body>
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
```

```tsx
// components/convex-provider.tsx
"use client";
import { ConvexProvider, ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
```

### 7. Homepage met project aanmaken

```tsx
// app/page.tsx
"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Home() {
  const projects = useQuery(api.projects.list);
  const createProject = useMutation(api.projects.create);
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    const id = await createProject({
      name: "Nieuw project",
      clientName: "Klantnaam",
      context: "",
      documentType: "voorstel",
    });
    router.push(`/project/${id}`);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold mb-8">Document Agent</h1>

        <button
          onClick={handleCreate}
          disabled={creating}
          className="w-full bg-white text-black rounded-xl p-4 text-sm font-medium
                     hover:bg-neutral-200 transition-colors mb-8"
        >
          + Nieuw Project
        </button>

        <div className="space-y-2">
          {projects?.map((p) => (
            <button
              key={p._id}
              onClick={() => router.push(`/project/${p._id}`)}
              className="w-full text-left bg-neutral-900 rounded-xl p-4 hover:bg-neutral-800
                         transition-colors border border-neutral-800"
            >
              <div className="text-sm font-medium">{p.name}</div>
              <div className="text-xs text-neutral-500">{p.clientName}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

## De System Prompt is het Geheim

De kwaliteit van de output staat of valt met de system prompt. De prompt hierboven is een startpunt. Na testen verfijn je hem door:

1. **Voorbeelden toevoegen** - Plak het VastVooruit voorstel HTML als voorbeeld in de prompt met "dit is het kwaliteitsniveau"
2. **Stijlregels verscherpen** - Specifieke CSS patterns die je wil zien
3. **Document templates** - Per type (voorstel/rapport/analyse) een structuur template
4. **Iteratie-instructies** - Hoe de agent moet omgaan met feedback

## Snel Testen

Na setup, test met dit eerste bericht:

> "Genereer een projectvoorstel voor VastVooruit (vastvooruit.nl). Ze zijn een energielabel bedrijf dat honderden woningen per week certificeert. Ze hebben een probleem: handmatige data-invoer in Uniec 3 kost 60% van hun binnendienstwerk. Wij bieden een gefaseerde automatiseringsoplossing: 1) digitaal opnameformulier, 2) Excel import pipeline, 3) browser automatisering. Discovery kost €3.500, totale investering €28-43K. Gebruik hun branding (donkergroen #425745)."

Als dat een goed document oplevert → de agent werkt.
