import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession, requireAdmin } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";
import { updateSubmissionStatus } from "@/services/surat-online.service";

export async function GET() {
  try {
    const client = createSupabaseAdminClient();
    if (!client) {
      return NextResponse.json({ ok: false, error: "Supabase service role belum dikonfigurasi." }, { status: 500 });
    }

    const { data, error } = await client
      .from("pengajuan_surat")
      .select("*, layanan(*)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("SUPABASE ADMIN SELECT ERROR");
      console.dir(error, { depth: null });
      throw error;
    }

    return NextResponse.json({ ok: true, data: data ?? [] });
  } catch (error) {
    console.error("===== FULL ERROR =====");
    console.dir(error, { depth: null });

    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
            : error,
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getAdminSession(request, { cookie: "admin" });
    if (session.error || !session.profile) return NextResponse.json({ ok: false, error: "Session admin tidak valid." }, { status: 401 });
    if (requireAdmin(session.profile)) return NextResponse.json({ ok: false, error: "Akses khusus admin." }, { status: 403 });

    const body = await request.json() as { id?: string; status?: string; catatan?: string; file_surat_url?: string };
    if (!body.id || !body.status) {
      return NextResponse.json({ ok: false, error: "ID dan status wajib diisi." }, { status: 400 });
    }

    const namaPetugas = session.profile.nama_lengkap ?? session.profile.username ?? "Petugas Kelurahan";
    const data = await updateSubmissionStatus(body.id, body.status, body.catatan, namaPetugas, body.file_surat_url, session.profile.id);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("===== ADMIN PATCH ERROR =====");
    console.dir(error, { depth: null });
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Gagal memperbarui status." }, { status: 500 });
  }
}
