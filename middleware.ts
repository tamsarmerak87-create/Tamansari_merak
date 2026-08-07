import { NextResponse, type NextRequest } from "next/server";

const protectedPrefixes = ["/dashboard", "/profile", "/profil", "/layanan", "/pengajuan", "/surat-online", "/tracking", "/posbankum"];
const adminPublicPaths = ["/admin/login"];

function isProtectedPath(pathname: string) {
    return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isAdminProtectedPath(pathname: string) {
    return pathname === "/admin" || (pathname.startsWith("/admin/") && !adminPublicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`)));
}

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    if (isAdminProtectedPath(pathname)) {
        const supabaseAuthToken = request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"));
        const response = NextResponse.next();
        response.headers.set("x-tamsar-admin-role-required", "admin,petugas");
        if (!supabaseAuthToken) {
            const url = request.nextUrl.clone();
            url.pathname = "/admin/login";
            url.searchParams.set("next", pathname);
            return NextResponse.redirect(url);
        }
        return response;
    }
    if (!isProtectedPath(pathname)) return NextResponse.next();

    const response = NextResponse.next();
    response.headers.set("x-tamsar-verification-required", "true");
    return response;
}

export const config = {
    matcher: ["/dashboard/:path*", "/profile/:path*", "/profil/:path*", "/layanan/:path*", "/pengajuan/:path*", "/surat-online/:path*", "/tracking/:path*", "/posbankum/:path*", "/admin/:path*"],
};