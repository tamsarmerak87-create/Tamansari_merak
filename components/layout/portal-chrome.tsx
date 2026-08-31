"use client";

import { usePathname } from "next/navigation";
import { FloatingActions } from "@/components/common/floating-actions";
import { WargaAuthProvider } from "@/components/auth/warga-auth-provider";
import { VerificationGuard } from "@/components/auth/verification-guard";
import { TamsarChatWidget } from "@/components/chat/tamsar-chat-widget";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";

export function PortalChrome({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isAdminPortal = pathname === "/admin" || pathname.startsWith("/admin/");
    const isPetugasPortal = pathname === "/petugas" || pathname.startsWith("/petugas/");
    const isWargaDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");

    if (isAdminPortal || isPetugasPortal) return <>{children}</>;

    if (isWargaDashboard) {
        return (
            <WargaAuthProvider>
                <VerificationGuard>{children}</VerificationGuard>
                <TamsarChatWidget />
            </WargaAuthProvider>
        );
    }

    return (
        <WargaAuthProvider>
            <Navbar />
            <VerificationGuard>{children}</VerificationGuard>
            <Footer />
            <FloatingActions />
            <TamsarChatWidget />
        </WargaAuthProvider>
    );
}