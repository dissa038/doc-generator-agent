"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Home() {
  const chats = useQuery(api.chats.list);
  const createChat = useMutation(api.chats.create);
  const deleteChat = useMutation(api.chats.remove);
  const router = useRouter();
  const [starting, setStarting] = useState(false);

  const handleNewChat = async () => {
    setStarting(true);
    const id = await createChat({ title: "Nieuw gesprek" });
    router.push(`/chat/${id}`);
  };

  const handleDelete = async (
    e: React.MouseEvent,
    id: Parameters<typeof deleteChat>[0]["id"]
  ) => {
    e.stopPropagation();
    await deleteChat({ id });
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-xl">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-3 tracking-tight">
            Document Agent
          </h1>
          <p className="text-neutral-400 text-lg">
            Chat met AI om professionele documenten te genereren
          </p>
        </div>

        {/* New Chat Button */}
        <button
          onClick={handleNewChat}
          disabled={starting}
          className="w-full bg-white text-black rounded-2xl p-5 text-base font-medium
                     hover:bg-neutral-100 transition-all mb-10 disabled:opacity-30
                     flex items-center justify-center gap-3"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          {starting ? "Even geduld..." : "Nieuw gesprek starten"}
        </button>

        {/* Chat History */}
        {chats && chats.length > 0 && (
          <div>
            <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3 px-1">
              Recente gesprekken
            </h2>
            <div className="space-y-1.5">
              {chats.map((chat) => (
                <button
                  key={chat._id}
                  onClick={() => router.push(`/chat/${chat._id}`)}
                  className="w-full text-left group bg-neutral-900/50 hover:bg-neutral-800/80 rounded-xl
                             p-4 transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="text-neutral-500 shrink-0"
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <span className="text-sm text-neutral-300 truncate">
                      {chat.title}
                    </span>
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, chat._id)}
                    className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-red-400
                               transition-all p-1 rounded-md hover:bg-neutral-700/50"
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
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
