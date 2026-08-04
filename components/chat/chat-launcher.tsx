"use client";

import { Headset } from "lucide-react";

type ChatLauncherProps = {
    onClick: () => void;
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
    dragging: boolean;
    style: React.CSSProperties;
};

export function ChatLauncher({ onClick, onPointerDown, dragging, style }: ChatLauncherProps) {
    return (
        <button
            type="button"
            aria-label="Buka Chat"
            onClick={onClick}
            onPointerDown={onPointerDown}
            style={style}
            className={`fixed z-[9998] grid rounded-full bg-gov-800 text-white shadow-[0_20px_60px_rgba(15,39,72,.3)] transition duration-200 ease-out hover:scale-[1.03] focus:outline-none focus:ring-4 focus:ring-gov-100 ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
        >
            <span className="grid size-full place-items-center rounded-full bg-gov-800">
                <Headset size={24} />
            </span>
        </button>
    );
}