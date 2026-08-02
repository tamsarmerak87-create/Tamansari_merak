"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, ChevronDown, Send, Sparkles, X } from "lucide-react";
import { MotionShell } from "@/components/common/motion-shell";
import { cn } from "@/utils/cn";

type ChatMessage = { role: "user" | "assistant"; content: string };

const quickPrompts = ["Bagaimana mengajukan surat online?", "Apa jam pelayanan Kelurahan Tamansari?", "Bagaimana kontak WhatsApp resmi?", "Apa layanan POSBANKUM?"];

function formatReply(text: string) {
    return text.split("\n").map((line, index) => line ? <p key={`${line}-${index}`} className={cn(index > 0 && "mt-2")}>{line}</p> : <br key={`br-${index}`} />);
}

export function TamsarChatWidget() {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: "Halo, saya TAMSAR CS. Tanyakan layanan, surat online, POSBANKUM, atau kontak resmi Kelurahan Tamansari." }]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const endRef = useRef<HTMLDivElement>(null);
    const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

    useEffect(() => {
        const onHash = () => setOpen(window.location.hash === "#chat");
        onHash();
        window.addEventListener("hashchange", onHash);
        return () => window.removeEventListener("hashchange", onHash);
    }, []);

    useEffect(() => {
        const openFromNavbar = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            const trigger = target?.closest('a[href="/#chat"], a[href="#chat"]');
            if (trigger) setOpen(true);
        };

        document.addEventListener("click", openFromNavbar);
        return () => document.removeEventListener("click", openFromNavbar);
    }, []);

    function closeChat() {
        setOpen(false);
        if (window.location.hash === "#chat") {
            window.history.replaceState(null, "", window.location.pathname + window.location.search);
        }
    }

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, open]);

    async function sendMessage(text?: string) {
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
    }

    return open ? <MotionShell className="fixed bottom-24 right-5 z-50 w-[min(92vw,24rem)]"><div className="overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-[0_30px_100px_rgba(15,39,72,.22)] backdrop-blur-2xl"><div className="flex items-start justify-between gap-4 bg-gov-800 p-5 text-white"><div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-2xl bg-accent-400 text-gov-950"><Bot size={20} /></div><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-200">TAMSAR CS</p><h3 className="text-lg font-black">Layanan cepat Kelurahan Tamansari</h3></div></div><div className="flex gap-1"><button onClick={closeChat} className="rounded-full p-2 hover:bg-white/10" aria-label="Minimize"><ChevronDown size={16} /></button><button onClick={closeChat} className="rounded-full p-2 hover:bg-white/10" aria-label="Tutup"><X size={16} /></button></div></div><div className="max-h-[24rem] space-y-3 overflow-y-auto bg-slate-50 p-4 text-sm">{messages.map((message, index) => <div key={`${message.role}-${index}`} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}><div className={cn("max-w-[85%] rounded-[1.5rem] px-4 py-3 leading-6 shadow-sm", message.role === "user" ? "bg-gov-800 text-white" : "bg-white text-gov-950")}>{formatReply(message.content)}</div></div>)}{loading ? <div className="text-xs font-semibold text-slate-500">Mengetik...</div> : null}<div ref={endRef} /></div><div className="space-y-3 border-t border-slate-200 bg-white p-4"><div className="flex flex-wrap gap-2">{quickPrompts.map((prompt) => <button key={prompt} onClick={() => void sendMessage(prompt)} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-gov-800 transition hover:bg-accent-100"><Sparkles size={12} className="mr-1 inline" />{prompt}</button>)}</div><form onSubmit={(event) => { event.preventDefault(); void sendMessage(); }} className="flex gap-2"><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Tulis pertanyaan Anda..." className="min-w-0 flex-1 rounded-full border border-slate-200 px-4 py-3 text-sm outline-none focus:border-gov-800" /><button type="submit" disabled={!canSend} className="inline-flex items-center justify-center rounded-full bg-gov-800 px-4 py-3 text-white disabled:opacity-50"><Send size={16} /></button></form></div></div></MotionShell> : null;
}