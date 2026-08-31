"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Loader2, Mic, Volume2, X } from "lucide-react";
import Image from "next/image";

type ChatMessage = { role: "user" | "assistant"; content: string };
type Status = "idle" | "listening" | "transcribing" | "thinking" | "speaking" | "error";
type CharacterPose = "idle" | "greeting" | "thinking" | "listening" | "speaking" | "success";
type Action = { label: string; url: string };

const quickActions: Action[] = [{ label: "Buat Surat", url: "/surat-online" }, { label: "Cek Pengajuan", url: "/surat-online/tracking" }, { label: "Persyaratan", url: "/layanan" }, { label: "Jam Pelayanan", url: "/kontak" }, { label: "POSBANKUM", url: "/posbankum" }, { label: "Hubungi Kelurahan", url: "/kontak" }];

export function TamsarChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: "Assalamualaikum 👋\nSaya TAMSAR, Asisten Digital Warga. Ada yang bisa saya bantu?" }]);
    const [input, setInput] = useState("");
    const [status, setStatus] = useState<Status>("idle");
    const [characterPose, setCharacterPose] = useState<CharacterPose>("idle");
    const [actions, setActions] = useState<Action[]>(quickActions);
    const [showMoreActions, setShowMoreActions] = useState(false);
    const [audioEnabled, setAudioEnabled] = useState(true);
    const recorder = useRef<MediaRecorder | null>(null);
    const chunks = useRef<Blob[]>([]);
    const audioUrl = useRef<string | null>(null);
    const endRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const syncOpen = useCallback((next: boolean) => {
        setIsOpen(next);
    }, []);

    const focusInput = useCallback(() => {
        window.setTimeout(() => inputRef.current?.focus(), 260);
    }, []);

    const openChat = useCallback(() => {
        setCharacterPose("greeting");
        syncOpen(true);
        focusInput();
    }, [focusInput, syncOpen]);

    const closeChat = useCallback(() => {
        setIsOpen(false);
        if (window.location.hash === "#chat") {
            window.history.replaceState(null, "", window.location.pathname + window.location.search);
        }
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

    useEffect(() => {
        if (!isOpen || characterPose !== "greeting") return;
        const timer = window.setTimeout(() => setCharacterPose("idle"), 2000);
        return () => window.clearTimeout(timer);
    }, [characterPose, isOpen]);

    const speak = useCallback(async (text: string) => {
        if (!audioEnabled) { setStatus("idle"); setCharacterPose("idle"); return; }
        try { const response = await fetch("/api/ai/tamsar/speech", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) }); if (!response.ok) { setStatus("idle"); setCharacterPose("idle"); return; } if (audioUrl.current) URL.revokeObjectURL(audioUrl.current); audioUrl.current = URL.createObjectURL(await response.blob()); const audio = new Audio(audioUrl.current); setStatus("speaking"); setCharacterPose("speaking"); audio.onended = () => { setStatus("idle"); setCharacterPose("idle"); }; await audio.play(); } catch { setStatus("idle"); setCharacterPose("idle"); }
    }, [audioEnabled]);

    const sendMessage = useCallback(async (text?: string) => {
        const content = (text ?? input).trim();
        if (!content || status === "thinking" || status === "transcribing" || status === "speaking") return;
        const nextMessages: ChatMessage[] = [...messages, { role: "user", content }];
        setInput("");
        setMessages(nextMessages);
        setStatus("thinking"); setCharacterPose("thinking"); setActions([]); setShowMoreActions(false);
        try {
            const response = await fetch("/api/ai/tamsar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: nextMessages }) });
            const data = await response.json() as { reply?: string; actions?: Action[] };
            const reply = data.reply ?? "Maaf, TAMSAR sedang mengalami gangguan.";
            setMessages((prev) => [...prev, { role: "assistant", content: reply }]); setActions(data.actions?.length ? data.actions : quickActions); void speak(reply);
        } catch {
            setMessages((prev) => [...prev, { role: "assistant", content: "Maaf, terjadi kendala koneksi." }]);
            setActions(quickActions); setStatus("error"); setCharacterPose("idle");
        } finally {
        }
    }, [input, messages, speak, status]);

    const startRecording = useCallback(async () => { try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const media = new MediaRecorder(stream); chunks.current = []; recorder.current = media; media.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); }; media.onstop = async () => { stream.getTracks().forEach((track) => track.stop()); setStatus("transcribing"); setCharacterPose("thinking"); const form = new FormData(); form.append("audio", new Blob(chunks.current, { type: media.mimeType || "audio/webm" }), "tamsar.webm"); try { const response = await fetch("/api/ai/tamsar/transcribe", { method: "POST", body: form }); const data = await response.json() as { text?: string }; if (!data.text) throw new Error(); setStatus("idle"); await sendMessage(data.text); } catch { setStatus("error"); setCharacterPose("idle"); setInput("Fitur suara gagal dipahami. Silakan ketik pertanyaan Anda."); } }; media.start(); setStatus("listening"); setCharacterPose("listening"); } catch { setStatus("error"); setCharacterPose("idle"); } }, [sendMessage]);
    const stopRecording = useCallback(() => recorder.current?.stop(), []);
    useEffect(() => () => { if (audioUrl.current) URL.revokeObjectURL(audioUrl.current); }, []);

    return <>
        <AnimatePresence>
            {isOpen ? (
                <motion.div
                    key="tamsar-chat-window"
                    className={`tamsar-panel fixed bottom-2.5 left-2.5 right-2.5 z-[9999] flex max-h-[calc(100dvh-20px)] flex-col overflow-hidden rounded-[18px] bg-[#FFFDF7] shadow-[0_14px_40px_rgba(6,78,59,.14)] md:bottom-[20px] md:left-auto md:right-[20px] md:h-[min(650px,calc(100dvh-30px))] md:w-[350px] ${status === "speaking" ? "tamsar-speaking" : status === "thinking" || status === "transcribing" ? "tamsar-thinking" : status === "error" ? "tamsar-error" : ""}`}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 30 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                >
                    <header className="flex h-20 shrink-0 items-center gap-3 border-b border-black/5 bg-[#064E3B] px-4 text-white">
                        <div className="tamsar-character-frame flex size-[58px] shrink-0 items-center justify-center p-1.5"><AnimatePresence mode="wait"><motion.div key={characterPose} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="flex size-full items-center justify-center"><Image src={`/assets/tamsar/${characterPose}.png`} width={200} height={315} alt={`Karakter TAMSAR ${characterPose}`} className={`tamsar-character tamsar-character--${characterPose} size-full object-contain`} priority /></motion.div></AnimatePresence></div>
                        <div className="min-w-0 flex-1"><h3 className="text-[15px] font-black">TAMSAR</h3><p className="mt-0.5 text-xs font-medium text-white/75">Siap membantu</p></div>
                        <button type="button" onClick={closeChat} className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-white/10" aria-label="Tutup"><X size={18} /></button>
                    </header>
                    <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3"><div className="space-y-3">{messages.map((message, index) => <div key={index} className={`max-w-[88%] whitespace-pre-wrap rounded-[14px] px-3.5 py-3 text-[13px] leading-5 font-semibold ${message.role === "user" ? "ml-auto bg-[#064E3B] text-white" : "border border-black/5 bg-white text-slate-700"}`}>{message.content}</div>)}{(status === "thinking" || status === "transcribing") && <Loader2 size={16} className="animate-spin text-[#064E3B]" />}<div ref={endRef} /></div></div>
                    <div className="shrink-0 border-t border-black/10 bg-[#FFFDF7] p-3"><div className="grid grid-cols-2 gap-1.5">{actions.slice(0, showMoreActions ? 6 : 4).map((action) => <a key={action.label} href={action.url} onClick={(event) => { event.preventDefault(); setCharacterPose("success"); window.setTimeout(() => { window.location.assign(action.url); }, 650); }} className="flex h-9 items-center justify-center truncate rounded-xl border border-black/5 bg-white px-2 text-[11px] font-black text-[#064E3B] transition-colors hover:bg-[#E8F5E9]">{action.label}</a>)}</div>{actions.length > 4 && <button type="button" onClick={() => setShowMoreActions((value) => !value)} className="mx-auto my-1.5 block min-h-7 px-2 text-[11px] font-bold text-[#064E3B]">{showMoreActions ? "Tutup Layanan Lainnya" : "Layanan Lainnya"}</button>}<div className="mb-1 flex items-center justify-between px-1"><button type="button" onClick={() => setAudioEnabled((value) => !value)} className="inline-flex min-h-7 items-center gap-1.5 text-[11px] font-bold text-[#064E3B]"><Volume2 size={14} />Suara {audioEnabled ? "ON" : "OFF"}</button><button type="button" onClick={status === "listening" ? stopRecording : startRecording} className="grid size-8 place-items-center text-[#064E3B]" aria-label={status === "listening" ? "Berhenti merekam" : "Mulai bicara"}><Mic size={16} /></button></div><form onSubmit={(event) => { event.preventDefault(); void sendMessage(); }} className="flex h-[50px] gap-2"><input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ketik pertanyaan..." className="min-w-0 flex-1 rounded-[14px] border border-black/10 bg-white px-3.5 text-sm outline-none focus:border-[#064E3B]" /><button type="submit" className="grid size-[50px] shrink-0 place-items-center rounded-[14px] bg-[#FBCB45]" aria-label="Kirim"><ArrowUp size={19} /></button></form></div>
                </motion.div>
            ) : null}
        </AnimatePresence>
    </>;
}