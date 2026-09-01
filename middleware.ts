import { NextResponse, type NextRequest } from "next/server";
import { verifyPortalSessionToken } from "@/lib/portal-session-token";

const protectedPrefixes = ["/dashboard", "/profile", "/profil", "/layanan", "/pengajuan", "/surat-online", "/tracking", "/posbankum"];
const adminPublicPaths = ["/admin/login"];
const petugasPublicPaths = ["/petugas/login"];

function isProtectedPath(pathname: string) {
    return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isAdminProtectedPath(pathname: string) {
    return pathname === "/admin" || (pathname.startsWith("/admin/") && !adminPublicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`)));
}

function isPetugasProtectedPath(pathname: string) {
    return pathname === "/petugas" || (pathname.startsWith("/petugas/") && !petugasPublicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`)));
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    if (isAdminProtectedPath(pathname)) {
        const adminSessionToken = await verifyPortalSessionToken(request.cookies.get("tamsar_admin_session")?.value);
        const petugasSessionToken = await verifyPortalSessionToken(request.cookies.get("tamsar_petugas_session")?.value);
        const response = NextResponse.next();
        response.headers.set("x-tamsar-admin-role-required", "admin");
        if (!adminSessionToken && petugasSessionToken) {
            const url = request.nextUrl.clone();
            url.pathname = "/petugas/dashboard";
            url.searchParams.set("error", "forbidden");
            return NextResponse.redirect(url);
        }
        if (!adminSessionToken) {
            const url = request.nextUrl.clone();
            url.pathname = "/admin/login";
            url.searchParams.set("next", pathname);
            return NextResponse.redirect(url);
        }
        return response;
    }
    if (isPetugasProtectedPath(pathname)) {
        const url = request.nextUrl.clone();
        if (!await verifyPortalSessionToken(request.cookies.get("tamsar_petugas_session")?.value)) {
            url.pathname = "/petugas/login";
            url.searchParams.set("next", pathname);
            return NextResponse.redirect(url);
        }
        if (pathname === "/petugas") {
            url.pathname = "/petugas/dashboard";
            return NextResponse.redirect(url);
        }
        return NextResponse.next();
    }
    if (!isProtectedPath(pathname)) return NextResponse.next();

    const response = NextResponse.next();
    response.headers.set("x-tamsar-verification-required", "true");
    return response;
}

export const config = {
    matcher: ["/dashboard/:path*", "/profile/:path*", "/profil/:path*", "/layanan/:path*", "/pengajuan/:path*", "/surat-online/:path*", "/tracking/:path*", "/posbankum/:path*", "/admin/:path*", "/petugas/:path*"],
};