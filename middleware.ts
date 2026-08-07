import { NextResponse, type NextRequest } from "next/server";

const protectedPrefixes = ["/dashboard", "/profile", "/profil", "/layanan", "/pengajuan", "/surat-online", "/tracking", "/posbankum"];

function isProtectedPath(pathname: string) {
    return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    if (!isProtectedPath(pathname)) return NextResponse.next();

    const response = NextResponse.next();
    response.headers.set("x-tamsar-verification-required", "true");
    return response;
}

export const config = {
    matcher: ["/dashboard/:path*", "/profile/:path*", "/profil/:path*", "/layanan/:path*", "/pengajuan/:path*", "/surat-online/:path*", "/tracking/:path*", "/posbankum/:path*"],
};