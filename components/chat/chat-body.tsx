"use client";

import { cn } from "@/utils/cn";

export type ChatMessage = { role: "user" | "assistant"; content: string };

type ChatBodyProps = {
    messages: ChatMessage[];
    loading: boolean;
    endRef: React.RefObject<HTMLDivElement | null>;
};

function formatReply(text: string) {
    return text.split("\n").map((line, index) => line ? <p key={`${line}-${index}`} className={cn(index > 0 && "mt-2")}>{line}</p> : <br key={`br-${index}`} />);
}

export function ChatBody({ messages, loading, endRef }: ChatBodyProps) {
    return (
        <div className="max-h-[24rem] flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4 text-sm overscroll-contain">
            {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[85%] rounded-[1.5rem] px-4 py-3 leading-6 shadow-sm", message.role === "user" ? "bg-gov-800 text-white" : "bg-white text-gov-950")}>{formatReply(message.content)}</div>
                </div>
            ))}
            {loading ? <div className="text-xs font-semibold text-slate-500">Mengetik...</div> : null}
            <div ref={endRef} />
        </div>
    );
}