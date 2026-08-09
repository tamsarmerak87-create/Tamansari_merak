import { NextRequest } from "next/server";
import { PATCH } from "@/app/api/admin/pengajuan/route";
import { getAdminSession } from "@/services/admin-session";

const actionByRole: Record<string, string> = {
    staff_pelayanan: "verifikasi",
    petugas_lapangan: "verifikasi",
    kepala_seksi: "setujui",
    seklur: "setujui",
    lurah: "selesai",
};

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { catatan?: string; action?: string };
    const session = await getAdminSession(request);
    const defaultAction = session.profile ? actionByRole[session.profile.role] : "verifikasi";
    return PATCH(new NextRequest(request.url, {
        method: "PATCH",
        headers: request.headers,
        body: JSON.stringify({ id, action: body.action ?? defaultAction, catatan_petugas: body.catatan, alasan_penolakan: body.catatan }),
    }));
}