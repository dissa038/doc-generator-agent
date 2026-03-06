"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useState } from "react";

const TEMPLATES = [
  {
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    title: "Voorstel",
    description: "Professioneel projectvoorstel voor een klant",
    prompt: "Maak een professioneel voorstel voor een klant",
    color: "from-blue-500 to-cyan-500",
  },
  {
    icon: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z",
    title: "Offerte",
    description: "Gedetailleerde offerte met prijzen en scope",
    prompt: "Genereer een offerte voor een project",
    color: "from-emerald-500 to-teal-500",
  },
  {
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    title: "Rapport",
    description: "Uitgebreid rapport met data en conclusies",
    prompt: "Ik heb een rapport nodig over een onderwerp",
    color: "from-violet-500 to-purple-500",
  },
  {
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
    title: "Analyse",
    description: "Strategische analyse met inzichten",
    prompt: "Maak een analyse van resultaten en prestaties",
    color: "from-amber-500 to-orange-500",
  },
  {
    icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
    title: "Handleiding",
    description: "Stap-voor-stap handleiding of documentatie",
    prompt: "Maak een handleiding voor een product of proces",
    color: "from-pink-500 to-rose-500",
  },
  {
    icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
    title: "Business Plan",
    description: "Compleet business plan met financials",
    prompt: "Maak een business plan voor een nieuw bedrijf",
    color: "from-indigo-500 to-blue-500",
  },
];

const FEATURES = [
  {
    icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
    title: "Chat-first",
    description: "Natuurlijk gesprek met AI die doorvraagt en context begrijpt",
  },
  {
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
    title: "Realtime streaming",
    description: "Zie het antwoord live binnenkomen terwijl de AI denkt",
  },
  {
    icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
    title: "Live preview",
    description: "Direct een professioneel HTML document naast de chat",
  },
  {
    icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
    title: "Versiegeschiedenis",
    description: "Elke iteratie wordt opgeslagen, blader terug door versies",
  },
  {
    icon: "M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z",
    title: "Delen",
    description: "Deel documenten via een link met klanten of collega's",
  },
  {
    icon: "M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    title: "Export",
    description: "Download als HTML of PDF, klaar om te versturen",
  },
];

export default function Home() {
  const chats = useQuery(api.chats.list);
  const createChat = useMutation(api.chats.create);
  const deleteChat = useMutation(api.chats.remove);
  const router = useRouter();
  const [starting, setStarting] = useState<string | null>(null);

  const handleNewChat = async (prompt?: string) => {
    const key = prompt || "new";
    setStarting(key);
    const id = await createChat({ title: "Nieuw gesprek" });
    if (prompt) {
      // Store prompt in sessionStorage so the chat page can pick it up
      sessionStorage.setItem(`template_prompt_${id}`, prompt);
    }
    router.push(`/chat/${id}`);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Hero */}
      <div className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-violet-950/20 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-violet-500/10 via-fuchsia-500/5 to-transparent rounded-full blur-3xl" />

        <div className="relative max-w-5xl mx-auto px-6 pt-20 pb-16">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-8">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-xs text-neutral-400">
                Powered by Claude AI
              </span>
            </div>

            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-4 bg-gradient-to-b from-white to-neutral-400 bg-clip-text text-transparent">
              Document Agent
            </h1>
            <p className="text-lg sm:text-xl text-neutral-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              Genereer professionele documenten door simpelweg te chatten.
              Voorstellen, offertes, rapporten — in seconden klaar.
            </p>

            <button
              onClick={() => handleNewChat()}
              disabled={starting !== null}
              className="inline-flex items-center gap-3 bg-white text-black rounded-2xl px-8 py-4 text-base font-semibold hover:bg-neutral-100 transition-all disabled:opacity-30 shadow-lg shadow-white/10 hover:shadow-white/20 hover:scale-[1.02] active:scale-[0.98]"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              {starting === "new" ? "Even geduld..." : "Start nieuw gesprek"}
            </button>
          </div>
        </div>
      </div>

      {/* Templates */}
      <div className="max-w-5xl mx-auto px-6 pb-16">
        <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-4">
          Start met een template
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {TEMPLATES.map((template) => (
            <button
              key={template.title}
              onClick={() => handleNewChat(template.prompt)}
              disabled={starting !== null}
              className="group text-left bg-neutral-900/50 hover:bg-neutral-800/80 border border-neutral-800/50 hover:border-neutral-700 rounded-2xl p-5 transition-all disabled:opacity-30"
            >
              <div
                className={`w-10 h-10 rounded-xl bg-gradient-to-br ${template.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={template.icon} />
                </svg>
              </div>
              <div className="font-medium text-sm text-white mb-1">
                {template.title}
              </div>
              <div className="text-xs text-neutral-500 leading-relaxed">
                {template.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Features */}
      <div className="max-w-5xl mx-auto px-6 pb-16">
        <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-4">
          Wat maakt het bijzonder
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="bg-neutral-900/30 border border-neutral-800/30 rounded-2xl p-5"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-neutral-500 mb-3"
              >
                <path d={feature.icon} />
              </svg>
              <div className="font-medium text-sm text-neutral-300 mb-1">
                {feature.title}
              </div>
              <div className="text-xs text-neutral-600 leading-relaxed">
                {feature.description}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Chats */}
      {chats && chats.length > 0 && (
        <div className="max-w-5xl mx-auto px-6 pb-20">
          <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-4">
            Recente gesprekken
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {chats.map((chat) => (
              <div
                key={chat._id}
                className="group relative bg-neutral-900/50 hover:bg-neutral-800/80 border border-neutral-800/50 hover:border-neutral-700 rounded-xl transition-all"
              >
                <button
                  onClick={() => router.push(`/chat/${chat._id}`)}
                  className="w-full text-left p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="text-neutral-600 shrink-0"
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <span className="text-sm text-neutral-300 truncate">
                      {chat.title}
                    </span>
                  </div>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-neutral-700 group-hover:text-neutral-400 transition-colors shrink-0"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteChat({ id: chat._id });
                  }}
                  className="absolute right-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-red-400 transition-all p-1.5 rounded-md hover:bg-neutral-700/50"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
