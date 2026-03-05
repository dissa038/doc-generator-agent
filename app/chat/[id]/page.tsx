"use client";

import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState, useRef, useEffect, use } from "react";

function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      elements.push(<br key={`br-${i}`} />);
      i++;
      continue;
    }

    const processInline = (str: string) => {
      const parts: React.ReactNode[] = [];
      const regex = /\*\*(.*?)\*\*/g;
      let lastIndex = 0;
      let match;
      let key = 0;

      while ((match = regex.exec(str)) !== null) {
        if (match.index > lastIndex) {
          parts.push(str.slice(lastIndex, match.index));
        }
        parts.push(
          <strong key={`b-${key++}`} className="font-semibold text-white">
            {match[1]}
          </strong>
        );
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < str.length) {
        parts.push(str.slice(lastIndex));
      }
      return parts.length > 0 ? parts : [str];
    };

    elements.push(
      <span key={`line-${i}`}>
        {processInline(line)}
        {i < lines.length - 1 && lines[i + 1]?.trim() !== "" ? "\n" : ""}
      </span>
    );
    i++;
  }

  return elements;
}

function StreamingDots() {
  return (
    <span className="inline-flex items-center gap-0.5 ml-1">
      <span className="w-1 h-1 bg-violet-400 rounded-full animate-bounce [animation-delay:0ms]" />
      <span className="w-1 h-1 bg-violet-400 rounded-full animate-bounce [animation-delay:150ms]" />
      <span className="w-1 h-1 bg-violet-400 rounded-full animate-bounce [animation-delay:300ms]" />
    </span>
  );
}

export default function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const chatId = id as Id<"chats">;
  const chat = useQuery(api.chats.get, { id: chatId });
  const messages = useQuery(api.messages.listByChat, { chatId });
  const latestDoc = useQuery(api.documents.latest, { chatId });
  const generate = useAction(api.generate.generate);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Check if agent is currently streaming
  const isStreaming = messages?.some((m) => m.isStreaming);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Show preview when document is generated
  useEffect(() => {
    if (latestDoc) setShowPreview(true);
  }, [latestDoc]);

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const message = input;
    setInput("");
    setLoading(true);

    if (inputRef.current) inputRef.current.style.height = "auto";

    try {
      await generate({ chatId, userMessage: message });
    } catch (error) {
      console.error("Generation failed:", error);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  const handleDownloadPDF = () => {
    if (!latestDoc) return;
    // Open HTML in new window and trigger print (Save as PDF)
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(latestDoc.html);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  if (!chat)
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-950 text-neutral-500 text-sm">
        Laden...
      </div>
    );

  const hasMessages = messages && messages.length > 0;

  return (
    <div className="flex h-screen bg-neutral-950">
      {/* Chat Panel */}
      <div
        className={`flex flex-col transition-all duration-300 ${
          showPreview && latestDoc ? "w-1/2" : "w-full"
        }`}
      >
        {/* Header */}
        <div className="h-14 border-b border-neutral-800/50 flex items-center justify-between px-5 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <a
              href="/"
              className="text-neutral-600 hover:text-neutral-300 transition-colors shrink-0"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </a>
            <span className="text-sm text-neutral-300 font-medium truncate">
              {chat.title}
            </span>
          </div>
          {latestDoc && (
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all shrink-0 ${
                showPreview
                  ? "bg-white text-black"
                  : "bg-neutral-800 text-neutral-400 hover:text-white"
              }`}
            >
              {showPreview ? "Preview verbergen" : "Preview tonen"}
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {!hasMessages && (
            <div className="flex flex-col items-center justify-center h-full px-6 text-center">
              <div className="text-3xl font-bold text-white mb-2">
                Wat wil je maken?
              </div>
              <p className="text-neutral-500 text-base max-w-md mb-8">
                Beschrijf het document dat je nodig hebt. Ik vraag door en maak
                het voor je.
              </p>
              <div className="grid grid-cols-2 gap-2 max-w-lg w-full">
                {[
                  "Maak een voorstel voor een nieuwe klant",
                  "Ik heb een rapport nodig over...",
                  "Genereer een offerte voor een webapp",
                  "Maak een analyse van onze resultaten",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setInput(suggestion);
                      inputRef.current?.focus();
                    }}
                    className="text-left text-sm text-neutral-400 bg-neutral-900/50 hover:bg-neutral-800/80
                               rounded-xl p-3.5 transition-all border border-neutral-800/50 hover:border-neutral-700"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {hasMessages && (
            <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
              {messages.map((msg) => (
                <div key={msg._id}>
                  {msg.role === "user" ? (
                    <div className="flex justify-end">
                      <div className="bg-neutral-800 text-white rounded-2xl rounded-br-md px-4 py-3 max-w-[80%] text-sm leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-start">
                      <div className="flex gap-3 max-w-[85%]">
                        <div
                          className={`w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 shrink-0 flex items-center justify-center mt-0.5 ${
                            msg.isStreaming ? "animate-pulse" : ""
                          }`}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="white"
                          >
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                          </svg>
                        </div>
                        <div className="text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap">
                          {msg.content ? (
                            <>
                              {renderMarkdown(msg.content)}
                              {msg.isStreaming && <StreamingDots />}
                            </>
                          ) : msg.isStreaming ? (
                            <span className="text-neutral-500 flex items-center gap-2">
                              <svg
                                className="animate-spin w-3.5 h-3.5"
                                viewBox="0 0 24 24"
                                fill="none"
                              >
                                <circle
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="3"
                                  className="opacity-20"
                                />
                                <path
                                  d="M12 2a10 10 0 0 1 10 10"
                                  stroke="currentColor"
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                />
                              </svg>
                              Nadenken...
                            </span>
                          ) : null}
                          {msg.documentGenerated && !msg.isStreaming && (
                            <span className="inline-flex items-center gap-1.5 mt-2 text-xs text-emerald-400 bg-emerald-400/10 rounded-full px-2.5 py-1">
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                              Document bijgewerkt
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 shrink-0">
          <form
            onSubmit={handleSubmit}
            className="max-w-3xl mx-auto relative"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Beschrijf wat je wilt maken..."
              rows={1}
              className="w-full bg-neutral-900 text-white rounded-2xl pl-5 pr-14 py-4 text-sm
                         placeholder:text-neutral-600 outline-none ring-1 ring-neutral-800
                         focus:ring-neutral-600 transition-all resize-none leading-relaxed"
              disabled={loading || isStreaming}
            />
            <button
              type="submit"
              disabled={loading || isStreaming || !input.trim()}
              className="absolute right-3 bottom-3 bg-white text-black rounded-xl w-9 h-9
                         flex items-center justify-center disabled:opacity-20
                         hover:bg-neutral-200 transition-all"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </form>
        </div>
      </div>

      {/* Document Preview Panel */}
      {showPreview && latestDoc && (
        <div className="w-1/2 border-l border-neutral-800/50 flex flex-col bg-neutral-900">
          {/* Preview Header */}
          <div className="h-14 border-b border-neutral-800/50 flex items-center justify-between px-5 shrink-0">
            <span className="text-xs text-neutral-500">
              Versie {latestDoc.version}
            </span>
            <div className="flex gap-1.5">
              <button
                onClick={() => {
                  const blob = new Blob([latestDoc.html], {
                    type: "text/html",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `document-v${latestDoc.version}.html`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="text-xs text-neutral-400 hover:text-white transition-colors
                           bg-neutral-800 rounded-lg px-3 py-1.5"
              >
                HTML
              </button>
              <button
                onClick={handleDownloadPDF}
                className="text-xs text-neutral-400 hover:text-white transition-colors
                           bg-neutral-800 rounded-lg px-3 py-1.5"
              >
                PDF
              </button>
            </div>
          </div>

          {/* Preview iframe */}
          <div className="flex-1 overflow-auto p-6 flex justify-center">
            <iframe
              ref={iframeRef}
              srcDoc={latestDoc.html}
              className="w-full max-w-[800px] bg-white rounded-xl shadow-2xl shadow-black/50"
              style={{ minHeight: "1100px" }}
              sandbox="allow-same-origin allow-popups allow-scripts allow-modals"
            />
          </div>
        </div>
      )}
    </div>
  );
}
