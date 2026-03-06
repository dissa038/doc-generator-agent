"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { use, useState, useCallback } from "react";

export default function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const doc = useQuery(api.documents.getByShareToken, { token });
  const [fullscreen, setFullscreen] = useState(false);

  const handleDownloadHTML = useCallback(() => {
    if (!doc) return;
    const blob = new Blob([doc.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `document-v${doc.version}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [doc]);

  const handleDownloadPDF = useCallback(() => {
    if (!doc) return;
    // Use srcDoc iframe approach for printing
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.srcdoc = doc.html;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    };
  }, [doc]);

  // Loading state
  if (doc === undefined) {
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
        Document laden...
      </div>
    );
  }

  // Not found
  if (doc === null) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-neutral-950 text-white">
        <div className="text-6xl mb-4">404</div>
        <div className="text-neutral-400 mb-6">
          Dit document bestaat niet of is verwijderd.
        </div>
        <a
          href="/"
          className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
        >
          Terug naar home
        </a>
      </div>
    );
  }

  if (fullscreen) {
    return (
      <div className="h-screen bg-white">
        <div className="fixed top-4 right-4 z-10">
          <button
            onClick={() => setFullscreen(false)}
            className="bg-neutral-900 text-white rounded-lg px-3 py-1.5 text-xs hover:bg-neutral-800 transition-colors shadow-lg"
          >
            Sluiten
          </button>
        </div>
        <iframe
          srcDoc={doc.html}
          className="w-full h-full border-0"
          sandbox="allow-same-origin allow-popups allow-scripts allow-modals"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Header */}
      <div className="border-b border-neutral-800/50 bg-neutral-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-sm font-medium text-neutral-400 group-hover:text-white transition-colors">
              Document Agent
            </span>
          </a>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFullscreen(true)}
              className="text-xs text-neutral-400 hover:text-white transition-colors bg-neutral-800 hover:bg-neutral-700 rounded-lg px-3 py-1.5"
            >
              Volledig scherm
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
      </div>

      {/* Document */}
      <div className="max-w-5xl mx-auto px-6 py-8 flex justify-center">
        <iframe
          srcDoc={doc.html}
          className="w-full max-w-[850px] bg-white rounded-xl shadow-2xl shadow-black/50"
          style={{ minHeight: "1200px" }}
          sandbox="allow-same-origin allow-popups allow-scripts allow-modals"
        />
      </div>

      {/* Footer */}
      <div className="text-center py-8 text-xs text-neutral-600">
        Gemaakt met Document Agent
      </div>
    </div>
  );
}
