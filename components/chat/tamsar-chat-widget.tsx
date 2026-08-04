"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatLauncher } from "@/components/chat/chat-launcher";
import { ChatOverlay } from "@/components/chat/chat-overlay";
import { ChatWindow } from "@/components/chat/chat-window";

type ChatMessage = { role: "user" | "assistant"; content: string };
type Position = { x: number; y: number };

const STORAGE_OPEN = "tamsar-chat-open";
const STORAGE_POSITION = "tamsar-chat-position";
const quickPrompts = ["Bagaimana mengajukan surat online?", "Apa jam pelayanan Kelurahan Tamansari?", "Bagaimana kontak WhatsApp resmi?", "Apa layanan POSBANKUM?"];
const defaultPosition = { x: 24, y: 24 };

function isDesktopWidth() {
    return window.innerWidth >= 1024;
}

function getStoredBoolean(key: string, fallback: boolean) {
    if (typeof window === "undefined") return fallback;
    const raw = window.localStorage.getItem(key);
    return raw == null ? fallback : raw === "true";
}

function getLauncherSize() {
    const w = window.innerWidth;
    if (w < 640) return 56;
    if (w < 1024) return 58;
    return 64;
}

function clampPosition(next: Position, size: number) {
    const x = Math.max(16, Math.min(next.x, window.innerWidth - size - 16));
    const y = Math.max(16, Math.min(next.y, window.innerHeight - size - 16));
    return { x, y };
}

export function TamsarChatWidget() {
    const [open, setOpen] = useState(() => getStoredBoolean(STORAGE_OPEN, false));
    const [closing, setClosing] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: "Halo, saya TAMSAR CS. Tanyakan layanan, surat online, POSBANKUM, atau kontak resmi Kelurahan Tamansari." }]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [position, setPosition] = useState<Position>(() => {
        if (typeof window === "undefined") return defaultPosition;
        const storedPosition = window.localStorage.getItem(STORAGE_POSITION);
        if (!storedPosition) return defaultPosition;
        try {
            return clampPosition(JSON.parse(storedPosition) as Position, getLauncherSize());
        } catch {
            return defaultPosition;
        }
    });
    const [dragging, setDragging] = useState(false);
    const endRef = useRef<HTMLDivElement>(null);
    const launcherRef = useRef<HTMLButtonElement>(null);
    const dragState = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);

    const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

    const syncOpen = useCallback((next: boolean) => {
        setOpen(next);
        window.localStorage.setItem(STORAGE_OPEN, String(next));
    }, []);

    const closeChat = useCallback(() => {
        setClosing(true);
        window.setTimeout(() => {
            syncOpen(false);
            setClosing(false);
            if (window.location.hash === "#chat") {
                window.history.replaceState(null, "", window.location.pathname + window.location.search);
            }
        }, 220);
    }, [syncOpen]);

    const openChat = useCallback(() => syncOpen(true), [syncOpen]);

    const handleEscape = useCallback((event: KeyboardEvent) => {
        if (event.key === "Escape") closeChat();
    }, [closeChat]);

    const persistPosition = useCallback((next: Position) => {
        setPosition(next);
        window.localStorage.setItem(STORAGE_POSITION, JSON.stringify(next));
    }, []);

    const onPointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
        if (!isDesktopWidth()) return;
        const rect = event.currentTarget.getBoundingClientRect();
        dragState.current = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
        setDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
    }, []);

    const onPointerMove = useCallback((event: PointerEvent) => {
        if (!dragState.current || !isDesktopWidth()) return;
        const size = getLauncherSize();
        persistPosition(clampPosition({ x: event.clientX - dragState.current.offsetX, y: event.clientY - dragState.current.offsetY }, size));
        if (position.x + size > window.innerWidth) persistPosition({ x: window.innerWidth - size - 16, y: position.y });
    }, [persistPosition, position.x, position.y]);

    const onPointerUp = useCallback(() => {
        if (dragState.current) {
            dragState.current = null;
            setDragging(false);
        }
    }, []);

    useEffect(() => {
        window.addEventListener("keydown", handleEscape);
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
        const onResize = () => setPosition((current) => clampPosition(current, getLauncherSize()));
        window.addEventListener("resize", onResize);
        return () => {
            window.removeEventListener("keydown", handleEscape);
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", onPointerUp);
            window.removeEventListener("resize", onResize);
        };
    }, [handleEscape, onPointerMove, onPointerUp]);

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, open]);
    useEffect(() => { document.body.style.overflow = open ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [open]);

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

    const launcherSize = getLauncherSize();
    const launcherStyle: React.CSSProperties = isDesktopWidth()
        ? { left: position.x, top: position.y, width: launcherSize, height: launcherSize, transform: "translate3d(0,0,0)" }
        : { right: 16, bottom: 16, width: launcherSize, height: launcherSize, transform: "translate3d(0,0,0)" };

    return <>
        <ChatOverlay open={open} onClose={closeChat} />
        <ChatLauncher onClick={openChat} onPointerDown={onPointerDown} dragging={dragging} style={launcherStyle} />
        {(open || closing) && <div className={`fixed ${open ? "animate-[chatIn_250ms_ease]" : "animate-[chatOut_200ms_ease]"} z-[9999]`}><ChatWindow messages={messages} loading={loading} input={input} quickPrompts={quickPrompts} endRef={endRef} onClose={closeChat} onMinimize={closeChat} onInputChange={setInput} onSend={sendMessage} /></div>}
    </>;
}