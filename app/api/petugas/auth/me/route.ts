import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession, isPetugas } from "@/services/admin-session";

export async function GET(request: NextRequest) {
    const session = await getAdminSession(request);
    if (session.error || !session.profile) return NextResponse.json({ ok: false }, { status: 401 });
    if (!isPetugas(session.profile)) return NextResponse.json({ ok: false }, { status: 403 });
    return NextResponse.json({ ok: true, user: { id: session.profile.id, username: session.profile.username }, profile: session.profile });
}