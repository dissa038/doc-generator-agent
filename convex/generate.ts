"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `Je bent een expert document-agent. Je helpt gebruikers om professionele, visueel indrukwekkende HTML-documenten te maken via een natuurlijk gesprek.

## HOE JE WERKT

Je bent een agent - je hebt een gesprek met de gebruiker en bouwt stap voor stap het perfecte document. Je workflow:

1. **Begrijp wat ze willen** - Vraag door over het type document (voorstel, rapport, analyse, offerte, etc.)
2. **Verzamel context** - Vraag naar de klant, het project, de diensten, prijzen, etc.
3. **Genereer het document** - Als je genoeg info hebt, maak je een SICK HTML document
4. **Itereer** - De gebruiker kan feedback geven en je past aan

## GESPREKSREGELS

- Wees casual maar professioneel. Je bent een collega, geen robot.
- Stel MAX 2-3 vragen per bericht. Niet alles tegelijk.
- Als de gebruiker een transcript of briefing plakt, haal daar zoveel mogelijk info uit
- Als je genoeg hebt om te starten, BEGIN gewoon. Je kunt altijd later aanpassen.
- Zeg kort wat je gaat doen en genereer dan het document
- Bij follow-up: pas het hele document aan, output altijd het COMPLETE document

## WANNEER JE EEN DOCUMENT GENEREERT

Als je besluit een document te genereren, output dan:
1. Een korte zin over wat je hebt gemaakt
2. Het complete HTML document

## HTML DOCUMENT REGELS

- Output ALLEEN valide HTML met inline <style> in de <head>
- Begin ALTIJD met <!DOCTYPE html>
- Gebruik Google Fonts via CDN link (kies opvallende, passende fonts - NIET Inter/Roboto/Arial)
- A4 print-ready, responsive
- GEEN placeholder content - alles moet echt zijn
- Taal: match de klant (Nederlands voor NL)
- CSS custom properties voor kleuren
- Inline SVG iconen (geen externe deps)
- Cover sectie met logo/titel/datum
- Secties met nummering
- Tabellen voor data, cards voor features
- Ruime whitespace, duidelijke hierarchie
- Gradient of solid backgrounds voor visuele afwisseling
- BOLD, opvallend design - dit moet WOW-effect geven

## BIJ ITERATIE
- Pas het HELE document aan
- Behoud styling tenzij anders gevraagd
- Output altijd het COMPLETE HTML document
- Als de gebruiker om een kleine aanpassing vraagt, doe die maar behoud de rest`;

export const generate = action({
  args: {
    chatId: v.id("chats"),
    userMessage: v.string(),
  },
  handler: async (ctx, { chatId, userMessage }) => {
    const chat = await ctx.runQuery(api.chats.get, { id: chatId });
    if (!chat) throw new Error("Chat not found");

    const messages = await ctx.runQuery(api.messages.listByChat, { chatId });
    const latestDoc = await ctx.runQuery(api.documents.latest, { chatId });

    // Save user message
    await ctx.runMutation(api.messages.send, {
      chatId,
      role: "user",
      content: userMessage,
    });

    // Create streaming placeholder message
    const streamingMsgId = await ctx.runMutation(api.messages.send, {
      chatId,
      role: "assistant",
      content: "",
      isStreaming: true,
    });

    // Build Claude messages
    const claudeMessages: Anthropic.MessageParam[] = [];

    for (const msg of messages) {
      claudeMessages.push({ role: msg.role, content: msg.content });
    }

    if (latestDoc) {
      claudeMessages.push({
        role: "user",
        content: `[SYSTEEM: Het huidige document (versie ${latestDoc.version}) is hieronder. Pas dit aan als de gebruiker wijzigingen vraagt.]\n\n${latestDoc.html}`,
      });
      claudeMessages.push({
        role: "assistant",
        content: "Begrepen, ik heb het huidige document. Wat wil je aanpassen?",
      });
    }

    claudeMessages.push({ role: "user", content: userMessage });

    // Stream from Claude
    const client = new Anthropic();
    let fullText = "";
    let lastUpdate = 0;
    const UPDATE_INTERVAL = 150; // ms between DB updates

    const stream = client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: claudeMessages,
    });

    stream.on("text", async (text) => {
      fullText += text;

      // Throttle DB updates to avoid hammering Convex
      const now = Date.now();
      if (now - lastUpdate > UPDATE_INTERVAL) {
        lastUpdate = now;

        // Only show the text part (before any HTML) while streaming
        const displayText = getDisplayText(fullText);
        await ctx.runMutation(api.messages.update, {
          id: streamingMsgId,
          content: displayText,
          isStreaming: true,
        });
      }
    });

    // Wait for stream to complete
    await stream.finalMessage();

    // Process complete response
    const htmlMatch = fullText.match(/<!DOCTYPE html>[\s\S]*<\/html>/i);
    const html = htmlMatch ? htmlMatch[0] : null;

    let textResponse = html
      ? fullText.replace(html, "").trim() ||
        "Document is gegenereerd! Check de preview hiernaast."
      : fullText;

    // Clean up
    textResponse = textResponse
      .replace(/```html\s*/g, "")
      .replace(/```\s*/g, "")
      .replace(/^---\s*$/gm, "")
      .trim();

    // Final update - mark as done
    await ctx.runMutation(api.messages.update, {
      id: streamingMsgId,
      content: textResponse,
      isStreaming: false,
      documentGenerated: !!html,
    });

    // Save document
    if (html) {
      const newVersion = (latestDoc?.version ?? 0) + 1;
      await ctx.runMutation(api.documents.save, {
        chatId,
        html,
        version: newVersion,
      });
    }

    // Auto-title
    if (messages.length <= 2 && chat.title === "Nieuw gesprek") {
      const titleResponse = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 30,
        system:
          "Geef een korte titel (max 5 woorden) voor dit gesprek. Alleen de titel, geen quotes.",
        messages: [{ role: "user", content: userMessage }],
      });
      let title = titleResponse.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim()
        .replace(/[#*`"']/g, "")
        .trim();
      // Limit to 50 chars
      if (title.length > 50) title = title.slice(0, 50);
      if (title) {
        await ctx.runMutation(api.chats.updateTitle, { id: chatId, title });
      }
    }

    return { success: true, hasDocument: !!html };
  },
});

// Show only the text before HTML starts (user-facing message)
function getDisplayText(text: string): string {
  // Check for code fence or DOCTYPE as HTML start markers
  const markers = ["<!DOCTYPE", "<!doctype", "```html", "```HTML"];
  let earliest = -1;

  for (const marker of markers) {
    const idx = text.indexOf(marker);
    if (idx !== -1 && (earliest === -1 || idx < earliest)) {
      earliest = idx;
    }
  }

  if (earliest === -1) return text;

  const before = text.slice(0, earliest).trim();
  return before || "Document wordt gegenereerd...";
}
