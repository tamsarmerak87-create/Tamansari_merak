"use client";

import { Send, Sparkles } from "lucide-react";

type ChatInputProps = {
    input: string;
    loading: boolean;
    quickPrompts: string[];
    onInputChange: (value: string) => void;
    onSend: (text?: string) => void;
};

export function ChatInput({ input, loading, quickPrompts, onInputChange, onSend }: ChatInputProps) {
    const canSend = input.trim().length > 0 && !loading;

    return (
        <div className="space-y-3 border-t border-slate-200 bg-white p-4">
            <div className="flex flex-wrap gap-2">
                {quickPrompts.map((prompt) => (
                    <button key={prompt} type="button" onClick={() => onSend(prompt)} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-gov-800 transition hover:bg-accent-100">
                        <Sparkles size={12} className="mr-1 inline" />{prompt}
                    </button>
                ))}
            </div>
            <form onSubmit={(event) => { event.preventDefault(); onSend(); }} className="flex gap-2">
                <input
                    value={input}
                    onChange={(event) => onInputChange(event.target.value)}
                    placeholder="Tulis pertanyaan Anda..."
                    className="min-w-0 flex-1 rounded-full border border-slate-200 px-4 py-3 text-sm outline-none focus:border-gov-800"
                />
                <button type="submit" disabled={!canSend} className="inline-flex items-center justify-center rounded-full bg-gov-800 px-4 py-3 text-white disabled:opacity-50">
                    <Send size={16} />
                </button>
            </form>
        </div>
    );
}