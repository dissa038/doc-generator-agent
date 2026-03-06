"use client";

import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState, useRef, useEffect, use, useCallback } from "react";

// --- Markdown Renderer ---
function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  const processInline = (str: string, keyPrefix: string) => {
    const parts: React.ReactNode[] = [];
    // Match **bold**, *italic*, `code`, and [links](url)
    const regex =
      /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\))/g;
    let lastIndex = 0;
    let match;
    let key = 0;

    while ((match = regex.exec(str)) !== null) {
      if (match.index > lastIndex) {
        parts.push(str.slice(lastIndex, match.index));
      }
      if (match[2]) {
        parts.push(
          <strong key={`${keyPrefix}-b-${key++}`} className="font-semibold text-white">
            {match[2]}
          </strong>
        );
      } else if (match[3]) {
        parts.push(
          <em key={`${keyPrefix}-i-${key++}`} className="italic">
            {match[3]}
          </em>
        );
      } else if (match[4]) {
        parts.push(
          <code
            key={`${keyPrefix}-c-${key++}`}
            className="bg-neutral-800 text-violet-300 px-1.5 py-0.5 rounded text-xs font-mono"
          >
            {match[4]}
          </code>
        );
      } else if (match[5] && match[6]) {
        parts.push(
          <a
            key={`${keyPrefix}-a-${key++}`}
            href={match[6]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-400 underline underline-offset-2 hover:text-violet-300"
          >
            {match[5]}
          </a>
        );
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < str.length) {
      parts.push(str.slice(lastIndex));
    }
    return parts.length > 0 ? parts : [str];
  };

  while (i < lines.length) {
    const line = lines[i];

    // Empty line
    if (line.trim() === "") {
      elements.push(<div key={`br-${i}`} className="h-2" />);
      i++;
      continue;
    }

    // Headers
    const headerMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const cls =
        level === 1
          ? "text-lg font-bold text-white mt-3 mb-1"
          : level === 2
            ? "text-base font-semibold text-white mt-2 mb-1"
            : "text-sm font-semibold text-neutral-200 mt-2 mb-0.5";
      elements.push(
        <div key={`h-${i}`} className={cls}>
          {processInline(headerMatch[2], `h-${i}`)}
        </div>
      );
      i++;
      continue;
    }

    // Unordered list
    if (line.match(/^\s*[-*]\s+/)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^\s*[-*]\s+/)) {
        const content = lines[i].replace(/^\s*[-*]\s+/, "");
        items.push(
          <li key={`li-${i}`} className="flex gap-2">
            <span className="text-violet-400 mt-1 shrink-0">
              <svg width="6" height="6" viewBox="0 0 6 6">
                <circle cx="3" cy="3" r="3" fill="currentColor" />
              </svg>
            </span>
            <span>{processInline(content, `li-${i}`)}</span>
          </li>
        );
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="space-y-1 my-1">
          {items}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (line.match(/^\s*\d+[.)]\s+/)) {
      const items: React.ReactNode[] = [];
      let num = 1;
      while (i < lines.length && lines[i].match(/^\s*\d+[.)]\s+/)) {
        const content = lines[i].replace(/^\s*\d+[.)]\s+/, "");
        items.push(
          <li key={`oli-${i}`} className="flex gap-2">
            <span className="text-neutral-500 shrink-0 tabular-nums text-xs mt-0.5 min-w-[1.25rem] text-right">
              {num++}.
            </span>
            <span>{processInline(content, `oli-${i}`)}</span>
          </li>
        );
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="space-y-1 my-1">
          {items}
        </ol>
      );
      continue;
    }

    // Regular paragraph
    elements.push(
      <span key={`line-${i}`}>
        {processInline(line, `p-${i}`)}
        {"\n"}
      </span>
    );
    i++;
  }

  return elements;
}

// --- Streaming Dots ---
function StreamingDots() {
  return (
    <span className="inline-flex items-center gap-0.5 ml-1">
      <span className="w-1 h-1 bg-violet-400 rounded-full animate-bounce [animation-delay:0ms]" />
      <span className="w-1 h-1 bg-violet-400 rounded-full animate-bounce [animation-delay:150ms]" />
      <span className="w-1 h-1 bg-violet-400 rounded-full animate-bounce [animation-delay:300ms]" />
    </span>
  );
}

// --- Version History Dropdown ---
function VersionSelector({
  versions,
  currentId,
  onSelect,
}: {
  versions: { _id: Id<"documents">; version: number; _creationTime: number }[];
  currentId: Id<"documents">;
  onSelect: (id: Id<"documents">) => void;
}) {
  const [open, setOpen] = useState(false);

  if (versions.length <= 1) {
    return (
      <span className="text-xs text-neutral-500">
        Versie {versions[0]?.version ?? 1}
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors bg-neutral-800/50 rounded-lg px-2.5 py-1.5"
      >
        Versie {versions.find((v) => v._id === currentId)?.version ?? "?"}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-neutral-900 border border-neutral-700 rounded-xl shadow-xl min-w-[160px] py-1 max-h-60 overflow-y-auto">
            {versions.map((v) => (
              <button
                key={v._id}
                onClick={() => {
                  onSelect(v._id);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between ${
                  v._id === currentId
                    ? "bg-violet-500/10 text-violet-300"
                    : "text-neutral-400 hover:bg-neutral-800 hover:text-white"
                }`}
              >
                <span>Versie {v.version}</span>
                <span className="text-neutral-600 text-[10px]">
                  {new Date(v._creationTime).toLocaleTimeString("nl-NL", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// --- Toast Notification ---
function Toast({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-neutral-800 border border-neutral-700 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-emerald-400"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
        {message}
      </div>
    </div>
  );
}

// --- Main Chat Page ---
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
  const versions = useQuery(api.documents.listVersions, { chatId });
  const generate = useAction(api.generate.generate);
  const generateShareToken = useMutation(api.documents.generateShareToken);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<Id<"documents"> | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [mobilePreview, setMobilePreview] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isStreaming = messages?.some((m) => m.isStreaming);

  // Select the document to display
  const selectedDoc =
    selectedDocId && versions
      ? versions.find((v) => v._id === selectedDocId) ?? latestDoc
      : latestDoc;

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Show preview when document is generated
  useEffect(() => {
    if (latestDoc) {
      setShowPreview(true);
      setSelectedDocId(latestDoc._id);
    }
  }, [latestDoc]);

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle template prompts
  useEffect(() => {
    const templatePrompt = sessionStorage.getItem(`template_prompt_${id}`);
    if (templatePrompt && messages && messages.length === 0 && !loading) {
      sessionStorage.removeItem(`template_prompt_${id}`);
      setInput(templatePrompt);
      // Auto-submit after a brief delay so user sees the prompt
      const timer = setTimeout(() => {
        setInput("");
        setLoading(true);
        generate({ chatId, userMessage: templatePrompt })
          .catch((err: unknown) => console.error("Generation failed:", err))
          .finally(() => {
            setLoading(false);
            inputRef.current?.focus();
          });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [id, messages, loading, chatId, generate]);

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

  const handleShare = useCallback(async () => {
    if (!selectedDoc) return;
    try {
      const token = await generateShareToken({ id: selectedDoc._id });
      const url = `${window.location.origin}/share/${token}`;
      await navigator.clipboard.writeText(url);
      setToast("Link gekopieerd!");
    } catch {
      setToast("Delen mislukt");
    }
  }, [selectedDoc, generateShareToken]);

  const handleDownloadHTML = useCallback(() => {
    if (!selectedDoc) return;
    const blob = new Blob([selectedDoc.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `document-v${selectedDoc.version}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [selectedDoc]);

  const handleDownloadPDF = useCallback(() => {
    if (!selectedDoc) return;
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(selectedDoc.html);
      printWindow.document.close();
      printWindow.onload = () => printWindow.print();
    }
  }, [selectedDoc]);

  if (!chat)
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-950 text-neutral-500 text-sm">
        <svg
          className="animate-spin w-5 h-5 mr-2"
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
        Laden...
      </div>
    );

  const hasMessages = messages && messages.length > 0;

  return (
    <div className="flex h-screen bg-neutral-950">
      {/* Chat Panel */}
      <div
        className={`flex flex-col transition-all duration-300 ${
          showPreview && selectedDoc ? "w-full lg:w-1/2" : "w-full"
        } ${mobilePreview ? "hidden lg:flex" : "flex"}`}
      >
        {/* Header */}
        <div className="h-14 border-b border-neutral-800/50 flex items-center justify-between px-4 sm:px-5 shrink-0">
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
          <div className="flex items-center gap-2">
            {selectedDoc && (
              <>
                {/* Mobile preview toggle */}
                <button
                  onClick={() => setMobilePreview(true)}
                  className="lg:hidden text-xs px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white transition-all"
                >
                  Preview
                </button>
                {/* Desktop preview toggle */}
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className={`hidden lg:block text-xs px-3 py-1.5 rounded-lg transition-all shrink-0 ${
                    showPreview
                      ? "bg-white text-black"
                      : "bg-neutral-800 text-neutral-400 hover:text-white"
                  }`}
                >
                  {showPreview ? "Preview verbergen" : "Preview tonen"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {!hasMessages && (
            <div className="flex flex-col items-center justify-center h-full px-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mb-6 shadow-lg shadow-violet-500/20">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-white mb-2">
                Wat wil je maken?
              </div>
              <p className="text-neutral-500 text-sm sm:text-base max-w-md mb-8">
                Beschrijf het document dat je nodig hebt. Ik vraag door en maak
                het voor je.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
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
                    className="text-left text-sm text-neutral-400 bg-neutral-900/50 hover:bg-neutral-800/80 rounded-xl p-3.5 transition-all border border-neutral-800/50 hover:border-neutral-700"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {hasMessages && (
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
              {messages.map((msg) => (
                <div key={msg._id}>
                  {msg.role === "user" ? (
                    <div className="flex justify-end">
                      <div className="bg-neutral-800 text-white rounded-2xl rounded-br-md px-4 py-3 max-w-[85%] sm:max-w-[80%] text-sm leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-start">
                      <div className="flex gap-3 max-w-[90%] sm:max-w-[85%]">
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
                        <div className="text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap min-w-0">
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
        <div className="p-3 sm:p-4 shrink-0">
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
              className="w-full bg-neutral-900 text-white rounded-2xl pl-4 sm:pl-5 pr-14 py-3.5 sm:py-4 text-sm placeholder:text-neutral-600 outline-none ring-1 ring-neutral-800 focus:ring-neutral-600 transition-all resize-none leading-relaxed"
              disabled={loading || isStreaming}
            />
            <button
              type="submit"
              disabled={loading || isStreaming || !input.trim()}
              className="absolute right-3 bottom-2.5 sm:bottom-3 bg-white text-black rounded-xl w-9 h-9 flex items-center justify-center disabled:opacity-20 hover:bg-neutral-200 transition-all"
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
      {((showPreview && selectedDoc) || mobilePreview) && selectedDoc && (
        <div
          className={`border-l border-neutral-800/50 flex flex-col bg-neutral-900 ${
            mobilePreview
              ? "fixed inset-0 z-40 border-l-0 lg:static lg:w-1/2 lg:border-l lg:z-auto"
              : "hidden lg:flex w-1/2"
          }`}
        >
          {/* Preview Header */}
          <div className="h-14 border-b border-neutral-800/50 flex items-center justify-between px-4 sm:px-5 shrink-0">
            <div className="flex items-center gap-3">
              {/* Mobile back button */}
              <button
                onClick={() => setMobilePreview(false)}
                className="lg:hidden text-neutral-500 hover:text-white transition-colors"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              {versions && versions.length > 0 && (
                <VersionSelector
                  versions={versions}
                  currentId={selectedDoc._id}
                  onSelect={setSelectedDocId}
                />
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleShare}
                className="text-xs text-neutral-400 hover:text-white transition-colors bg-neutral-800 hover:bg-neutral-700 rounded-lg px-3 py-1.5 flex items-center gap-1.5"
                title="Deel link kopiëren"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Delen
              </button>
              <button
                onClick={handleDownloadHTML}
                className="text-xs text-neutral-400 hover:text-white transition-colors bg-neutral-800 hover:bg-neutral-700 rounded-lg px-3 py-1.5"
              >
                HTML
              </button>
              <button
                onClick={handleDownloadPDF}
                className="text-xs text-neutral-400 hover:text-white transition-colors bg-neutral-800 hover:bg-neutral-700 rounded-lg px-3 py-1.5"
              >
                PDF
              </button>
            </div>
          </div>

          {/* Preview iframe */}
          <div className="flex-1 overflow-auto p-4 sm:p-6 flex justify-center">
            <iframe
              srcDoc={selectedDoc.html}
              className="w-full max-w-[800px] bg-white rounded-xl shadow-2xl shadow-black/50"
              style={{ minHeight: "1100px" }}
              sandbox="allow-same-origin allow-popups allow-scripts allow-modals"
            />
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
