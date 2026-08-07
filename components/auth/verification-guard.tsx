"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { getVerificationRedirectPath, isVerified } from "@/services/warga-auth.service";
import { useWargaAuth } from "@/components/auth/warga-auth-provider";

const protectedPrefixes = ["/dashboard", "/profile", "/profil", "/layanan", "/pengajuan", "/surat-online", "/tracking", "/posbankum"];
const authStatusPages = ["/verify", "/verification-rejected"];

function isProtectedPath(pathname: string) {
    return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function VerificationGuard({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, profile, loading } = useWargaAuth();

    const protectedPath = useMemo(() => isProtectedPath(pathname), [pathname]);
    const statusPage = authStatusPages.includes(pathname);
    const shouldBlock = protectedPath && (loading || !user || !isVerified(profile));

    useEffect(() => {
        if (loading) return;
        if (protectedPath && !user) {
            router.replace("/login");
            return;
        }
        if (protectedPath && user && !isVerified(profile)) {
            router.replace(getVerificationRedirectPath(profile));
            return;
        }
        if (statusPage && user && profile) {
            const target = getVerificationRedirectPath(profile);
            if (target !== pathname) router.replace(target);
        }
    }, [loading, pathname, profile, protectedPath, router, statusPage, user]);

    if (shouldBlock) {
        return <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,rgba(255,197,51,.24),transparent_30%),linear-gradient(180deg,#f8fafc,#eef4ff)] px-5 text-gov-950">
            <div className="rounded-[32px] border border-white/70 bg-white/85 p-8 text-center shadow-[0_24px_80px_rgba(11,44,106,.16)] backdrop-blur-xl">
                <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-gov-950 text-accent-300"><ShieldCheck className="size-8" /></div>
                <Loader2 className="mx-auto mt-6 size-7 animate-spin text-accent-500" />
                <p className="mt-4 text-lg font-black">Memeriksa status verifikasi warga...</p>
                <p className="mt-2 max-w-md text-sm font-semibold text-slate-500">Dashboard dan layanan hanya dapat dibuka setelah akun dinyatakan Terverifikasi oleh petugas.</p>
            </div>
        </main>;
    }

    return <>{children}</>;
}