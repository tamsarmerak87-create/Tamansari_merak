"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Clock3, Loader2, ShieldCheck } from "lucide-react";
import { getVerificationRedirectPath, isVerified } from "@/services/warga-auth.service";
import { useWargaAuth } from "@/components/auth/warga-auth-provider";

const protectedPrefixes = ["/dashboard", "/profile", "/profil", "/layanan", "/pengajuan", "/surat-online", "/tracking", "/posbankum"];
const authStatusPages = ["/verify", "/verification-rejected"];

function isProtectedPath(pathname: string) {
    // The dashboard owns its pending-account state, so returning there must not reopen this guard card.
    if (pathname === "/dashboard") return false;
    return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function VerificationGuard({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, profile, loading } = useWargaAuth();

    const protectedPath = useMemo(() => isProtectedPath(pathname), [pathname]);
    const statusPage = authStatusPages.includes(pathname);
    const shouldBlock = protectedPath && (loading || !user || !isVerified(profile));
    const waitingForOfficer = protectedPath && !loading && Boolean(user) && Boolean(profile) && profile?.status_verifikasi !== "Ditolak" && !isVerified(profile);

    useEffect(() => {
        if (loading) return;
        if (protectedPath && !user) {
            router.replace("/login");
            return;
        }
        if (protectedPath && user && !profile) return;
        if (protectedPath && user && profile && !isVerified(profile)) {
            const target = getVerificationRedirectPath(profile);
            if (target === "/verification-rejected") router.replace(target);
            return;
        }
        if (statusPage && user && profile) {
            const target = getVerificationRedirectPath(profile);
            if (target !== pathname) router.replace(target);
        }
    }, [loading, pathname, profile, protectedPath, router, statusPage, user]);

    if (shouldBlock) {
        if (waitingForOfficer) return <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,rgba(255,197,51,.24),transparent_30%),linear-gradient(180deg,#f8fafc,#eef4ff)] px-5 py-10 text-gov-950">
            <div className="w-full max-w-lg rounded-[32px] border border-white/70 bg-white/90 p-7 text-center shadow-[0_24px_80px_rgba(11,44,106,.16)] backdrop-blur-xl sm:p-10">
                <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-amber-100 text-amber-700"><Clock3 className="size-8" aria-hidden="true" /></div>
                <h1 className="mt-6 text-2xl font-black tracking-tight sm:text-3xl">Akun Menunggu Verifikasi</h1>
                <p className="mt-4 text-base font-bold text-slate-700">Akun Anda sedang menunggu verifikasi petugas.</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">Petugas Kelurahan Tamansari sedang memverifikasi akun Anda.<br />Silakan tunggu sampai proses verifikasi selesai.</p>
                <span className="mt-7 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-black uppercase tracking-wider text-amber-800"><Clock3 className="mr-2 size-4" aria-hidden="true" />Menunggu Verifikasi</span>
            </div>
        </main>;
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