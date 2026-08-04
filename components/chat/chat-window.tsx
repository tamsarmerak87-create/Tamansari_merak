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
        <div className="flex h-full w-full flex-col overflow-hidden">
            <ChatHeader onMinimize={onMinimize} onClose={onClose} />
            <ChatBody messages={messages} loading={loading} endRef={endRef} />
            <ChatInput input={input} loading={loading} quickPrompts={quickPrompts} inputRef={inputRef} onInputChange={onInputChange} onSend={onSend} />
        </div>
    );
}