"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChatLauncher } from "@/components/chat/chat-launcher";
import { ChatOverlay } from "@/components/chat/chat-overlay";
import { ChatWindow } from "@/components/chat/chat-window";

type ChatMessage = { role: "user" | "assistant"; content: string };

const STORAGE_OPEN = "tamsar-chat-open";
const quickPrompts = ["Bagaimana mengajukan surat online?", "Apa jam pelayanan Kelurahan Tamansari?", "Bagaimana kontak WhatsApp resmi?", "Apa layanan POSBANKUM?"];

function getStoredBoolean(key: string, fallback: boolean) {
    if (typeof window === "undefined") return fallback;
    const raw = window.localStorage.getItem(key);
    return raw == null ? fallback : raw === "true";
}

export function TamsarChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: "Halo, saya TAMSAR CS. Tanyakan layanan, surat online, POSBANKUM, atau kontak resmi Kelurahan Tamansari." }]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const endRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const syncOpen = useCallback((next: boolean) => {
        setIsOpen(next);
        window.localStorage.setItem(STORAGE_OPEN, String(next));
    }, []);

    const focusInput = useCallback(() => {
        window.setTimeout(() => inputRef.current?.focus(), 260);
    }, []);

    const openChat = useCallback(() => {
        syncOpen(true);
        focusInput();
    }, [focusInput, syncOpen]);

    const closeChat = useCallback(() => {
        syncOpen(false);
        if (window.location.hash === "#chat") {
            window.history.replaceState(null, "", window.location.pathname + window.location.search);
        }
    }, [syncOpen]);

    useEffect(() => {
        setIsOpen(getStoredBoolean(STORAGE_OPEN, false));
    }, []);

    useEffect(() => {
        const onOpenRequest = () => openChat();
        window.addEventListener("tamsar-chat:open", onOpenRequest);
        return () => window.removeEventListener("tamsar-chat:open", onOpenRequest);
    }, [openChat]);

    const handleEscape = useCallback((event: KeyboardEvent) => {
        if (event.key === "Escape") closeChat();
    }, [closeChat]);

    useEffect(() => {
        window.addEventListener("keydown", handleEscape);
        return () => {
            window.removeEventListener("keydown", handleEscape);
        };
    }, [handleEscape]);

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isOpen]);
    useEffect(() => { document.body.style.overflow = isOpen ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [isOpen]);

    const sendMessage = useCallback(async (text?: string) => {
        const content = (text ?? input).trim();
        if (!content || loading) return;
        const nextMessages: ChatMessage[] = [...messages, { role: "user", content }];
        setInput("");
        setMessages(nextMessages);
        setLoading(true);
        try {
            const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: nextMessages }) });
            const data = await response.json() as { reply?: string; error?: string };
            setMessages((prev) => [...prev, { role: "assistant", content: data.reply ?? data.error ?? "Maaf, terjadi kendala." }]);
        } catch {
            setMessages((prev) => [...prev, { role: "assistant", content: "Maaf, terjadi kendala koneksi." }]);
        } finally {
            setLoading(false);
        }
    }, [input, loading, messages]);

    return <>
        <ChatOverlay open={isOpen} onClose={closeChat} />
        <ChatLauncher onClick={openChat} />
        <AnimatePresence>
            {isOpen ? (
                <motion.div
                    key="tamsar-chat-window"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 30 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                >
                    <ChatWindow messages={messages} loading={loading} input={input} quickPrompts={quickPrompts} endRef={endRef} inputRef={inputRef} onClose={closeChat} onMinimize={closeChat} onInputChange={setInput} onSend={sendMessage} />
                </motion.div>
            ) : null}
        </AnimatePresence>
    </>;
}