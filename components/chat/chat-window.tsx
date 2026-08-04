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
    inputRef?: RefObject<HTMLInputElement | null>;
    onClose: () => void;
    onMinimize: () => void;
    onInputChange: (value: string) => void;
    onSend: (text?: string) => void;
};

export function ChatWindow({ messages, loading, input, quickPrompts, endRef, inputRef, onClose, onMinimize, onInputChange, onSend }: ChatWindowProps) {
    return (
        <div className="fixed bottom-20 left-[10px] right-[10px] z-[9999] flex h-[70vh] w-auto flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_30px_100px_rgba(15,39,72,.22)] backdrop-blur-2xl md:left-auto md:right-5 md:bottom-[90px] md:h-[min(700px,_calc(100vh-140px))] md:w-[350px] md:max-h-[calc(100vh-120px)] lg:right-5 lg:w-[390px] lg:h-[min(700px,_calc(100vh-140px))] lg:max-h-[calc(100vh-120px)]">
            <ChatHeader onMinimize={onMinimize} onClose={onClose} />
            <ChatBody messages={messages} loading={loading} endRef={endRef} />
            <ChatInput input={input} loading={loading} quickPrompts={quickPrompts} inputRef={inputRef} onInputChange={onInputChange} onSend={onSend} />
        </div>
    );
}