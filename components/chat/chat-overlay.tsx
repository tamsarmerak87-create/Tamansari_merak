"use client";

type ChatOverlayProps = {
    open: boolean;
    onClose: () => void;
};

export function ChatOverlay({ open, onClose }: ChatOverlayProps) {
    if (!open) return null;

    return <button type="button" aria-label="Tutup Chat" onClick={onClose} className="fixed inset-0 z-[9997] cursor-default bg-black/35 md:hidden" />;
}