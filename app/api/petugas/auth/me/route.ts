import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/services/admin-session";

export async function GET(request: NextRequest) {
    const session = await getAdminSession(request);
    if (session.error || !session.profile) return NextResponse.json({ ok: false }, { status: 401 });
    return NextResponse.json({ ok: true, user: { id: session.profile.id, username: session.profile.username }, profile: session.profile });
}