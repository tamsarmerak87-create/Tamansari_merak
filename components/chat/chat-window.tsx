"use client";

import type { RefObject } from "react";
import { ChatBody, type ChatMessage } from "@/components/chat/chat-body";
import { ChatHeader } from "@/components/chat/chat-header";
import { ChatInput } from "@/components/chat/chat-input";

type ChatWindowProps = {
    messages: ChatMessage[];
    loading: boolean;
    input: string;
    quickPrompts: string[];
    endRef: RefObject<HTMLDivElement | null>;
    onClose: () => void;
    onMinimize: () => void;
    onInputChange: (value: string) => void;
    onSend: (text?: string) => void;
};

export function ChatWindow({ messages, loading, input, quickPrompts, endRef, onClose, onMinimize, onInputChange, onSend }: ChatWindowProps) {
    return (
        <div className="fixed z-[9999] flex h-[70vh] max-h-[650px] min-h-[420px] w-auto flex-col overflow-hidden rounded-[20px] border border-white/80 bg-white shadow-[0_30px_100px_rgba(15,39,72,.22)] backdrop-blur-2xl md:h-[70vh] lg:h-[620px] xl:h-[650px] xl:w-[400px] lg:w-[380px] lg:rounded-[24px] md:w-[min(92vw,380px)] max-md:left-3 max-md:right-3 max-md:bottom-[90px] max-md:w-auto max-md:rounded-[20px] lg:right-[20px] lg:bottom-[90px] xl:right-[24px] xl:bottom-[100px]">
            <ChatHeader onMinimize={onMinimize} onClose={onClose} />
            <ChatBody messages={messages} loading={loading} endRef={endRef} />
            <ChatInput input={input} loading={loading} quickPrompts={quickPrompts} onInputChange={onInputChange} onSend={onSend} />
        </div>
    );
}