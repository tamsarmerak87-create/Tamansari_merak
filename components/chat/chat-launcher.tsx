"use client";

import { Headset } from "lucide-react";

type ChatLauncherProps = {
    onClick: () => void;
};

export function ChatLauncher({ onClick }: ChatLauncherProps) {
    return (
        <button
            type="button"
            aria-label="Buka Chat"
            onClick={onClick}
            className="fixed bottom-[20px] right-[20px] z-[9998] grid size-14 rounded-full bg-gov-800 text-white shadow-[0_20px_60px_rgba(15,39,72,.3)] transition duration-200 ease-out hover:scale-[1.03] focus:outline-none focus:ring-4 focus:ring-gov-100 sm:size-[58px] lg:size-16"
        >
            <span className="grid size-full place-items-center rounded-full bg-gov-800">
                <Headset size={24} />
            </span>
        </button>
    );
}