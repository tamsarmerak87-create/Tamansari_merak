import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession, requireAdmin } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";
import { appendWargaHistory, notifyWargaAccount } from "@/services/warga-verification-workflow";

type VerificationRequestBody = {
    wargaId?: string;
    id?: string;
    nama_lengkap?: string;
    nik?: string;
    email?: string;
    nomor_hp?: string | null;
    nomor_whatsapp?: string | null;
    nomor_kk?: string | null;
    tempat_lahir?: string | null;
    tanggal_lahir?: string | null;
    jenis_kelamin?: string | null;
    alamat?: string | null;
    rt?: string | null;
    rw?: string | null;
    kelurahan?: string | null;
    kecamatan?: string | null;
    status_verifikasi?: "Belum Terverifikasi" | "Belum Diverifikasi" | "Menunggu Staff Pelayanan" | "Menunggu Petugas Lapangan" | "Menunggu Kasi" | "Menunggu Sek Lur" | "Menunggu Lurah" | "Dikembalikan" | "Ditolak" | "Terverifikasi";
    alasan_penolakan?: string | null;
};

const WARGA_SELECT = "id,nama_lengkap,nik,email,nomor_hp,nomor_whatsapp,nomor_kk,tempat_lahir,tanggal_lahir,jenis_kelamin,alamat,rt,rw,kelurahan,kecamatan,status_verifikasi,alasan_penolakan,created_at";

function jsonError(message: string, status = 400) {
    return NextResponse.json({ ok: false, error: message }, { status });
}

function textValue(value: unknown) {
    if (value === undefined) return undefined;
    const trimmed = String(value ?? "").trim();
    return trimmed || null;
}

export async function PATCH(request: NextRequest) {
    try {
        const session = await getAdminSession(request, { cookie: "admin" });
        if (session.error || !session.profile) {
            return NextResponse.json({ ok: false, error: "Sesi admin/petugas tidak valid." }, { status: 401 });
        }
        const adminOnlyError = requireAdmin(session.profile);
        if (adminOnlyError) {
            return NextResponse.json({ ok: false, error: "Hanya admin yang dapat memverifikasi akun warga." }, { status: 403 });
        }

        const body = (await request.json()) as VerificationRequestBody;
        const wargaId = body.wargaId ?? body.id;

        if (!wargaId) {
            return NextResponse.json({ ok: false, error: "ID warga wajib diisi." }, { status: 400 });
        }

        const nextStatus = body.status_verifikasi;
        const allowedStatuses = ["Belum Terverifikasi", "Belum Diverifikasi", "Menunggu Staff Pelayanan", "Menunggu Petugas Lapangan", "Menunggu Kasi", "Menunggu Sek Lur", "Menunggu Lurah", "Dikembalikan", "Ditolak", "Terverifikasi"];
        if (!nextStatus || !allowedStatuses.includes(nextStatus)) {
            return NextResponse.json({ ok: false, error: "Status verifikasi tidak valid." }, { status: 400 });
        }

        if (nextStatus === "Ditolak" && !body.alasan_penolakan?.trim()) {
            return NextResponse.json({ ok: false, error: "Alasan penolakan wajib diisi." }, { status: 400 });
        }

        const supabase = createSupabaseAdminClient();
        const { data: current, error: currentError } = await supabase.from("warga_profiles").select("*").eq("id", wargaId).maybeSingle();
        if (currentError) return jsonError(currentError.message, 500);
        if (!current) return jsonError("Data warga tidak ditemukan.", 404);

        const updatePayload = {
            status_verifikasi: nextStatus,
            alasan_penolakan: nextStatus === "Ditolak" ? body.alasan_penolakan?.trim() : null,
            verified_at: nextStatus === "Terverifikasi" ? new Date().toISOString() : null,
            verified_by: nextStatus === "Terverifikasi" ? session.profile.id : null,
            tahap_verifikasi: nextStatus === "Terverifikasi" ? "Terverifikasi" : nextStatus.replace(/^Menunggu\s+/, ""),
            verification_history: appendWargaHistory(current, { action: nextStatus === "Terverifikasi" ? "admin_terverifikasi" : nextStatus === "Ditolak" ? "admin_tolak" : "admin_update", status_sebelum: current.status_verifikasi, status_sesudah: nextStatus, role: session.profile.role, petugas_id: session.profile.id, nama_petugas: session.profile.nama_lengkap ?? session.profile.username, catatan: body.alasan_penolakan ?? null }),
        };

        const { data, error } = await supabase
            .from("warga_profiles")
            .update(updatePayload)
            .eq("id", wargaId)
            .select("id,nama_lengkap,nik,email,status_verifikasi,alasan_penolakan,verified_at,verified_by");

        if (error) {
            return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
        }

        if (!data || data.length === 0) {
            return NextResponse.json(
                { ok: false, error: "Tidak ada data warga yang diperbarui. Periksa ID warga atau policy RLS." },
                { status: 400 },
            );
        }

        if (nextStatus === "Terverifikasi") await notifyWargaAccount(current, "Akun Terverifikasi", "Akun warga Anda sudah terverifikasi oleh Admin.");
        if (nextStatus === "Ditolak") await notifyWargaAccount(current, "Akun Ditolak", "Verifikasi akun warga Anda ditolak.", body.alasan_penolakan);
        return NextResponse.json({ ok: true, data });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Gagal memperbarui verifikasi warga.";
        console.error(`[api/admin/verifikasi] ${message}`);
        return NextResponse.json(
            { ok: false, error: error instanceof Error ? error.message : "Gagal memperbarui verifikasi warga." },
            { status: 500 },
        );
    }
}

export async function PUT(request: NextRequest) {
    try {
        const session = await getAdminSession(request, { cookie: "admin" });
        if (session.error || !session.profile) return jsonError("Sesi admin/petugas tidak valid.", 401);
        if (requireAdmin(session.profile)) return jsonError("Hanya admin yang dapat mengubah data warga.", 403);

        const body = (await request.json()) as VerificationRequestBody;
        const wargaId = body.wargaId ?? body.id;
        if (!wargaId) return jsonError("ID warga wajib diisi.");
        if (!body.nama_lengkap?.trim()) return jsonError("Nama lengkap wajib diisi.");
        if (!body.nik?.trim()) return jsonError("NIK wajib diisi.");
        if (!body.email?.trim()) return jsonError("Email wajib diisi.");

        const supabase = createSupabaseAdminClient();
        const { data: current, error: currentError } = await supabase.from("warga_profiles").select("id,role").eq("id", wargaId).maybeSingle();
        if (currentError) return jsonError(currentError.message, 500);
        if (!current) return jsonError("Data warga tidak ditemukan.", 404);
        if (current.role && current.role !== "warga") return jsonError("Data petugas/admin tidak boleh diubah dari modul warga.", 403);

        const updatePayload: Record<string, string | null> = {
            nama_lengkap: body.nama_lengkap.trim(),
            nik: body.nik.trim(),
            email: body.email.trim(),
        };
        for (const key of ["nomor_hp", "nomor_whatsapp", "nomor_kk", "tempat_lahir", "tanggal_lahir", "jenis_kelamin", "alamat", "rt", "rw", "kelurahan", "kecamatan"] as const) {
            const value = textValue(body[key]);
            if (value !== undefined) updatePayload[key] = value;
        }

        const { data, error } = await supabase.from("warga_profiles").update(updatePayload).eq("id", wargaId).select(WARGA_SELECT).single();
        if (error) return jsonError(error.message, 500);
        return NextResponse.json({ ok: true, data });
    } catch (error) {
        console.error("[api/admin/verifikasi:PUT]", error);
        return jsonError(error instanceof Error ? error.message : "Gagal mengubah data warga.", 500);
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const session = await getAdminSession(request, { cookie: "admin" });
        if (session.error || !session.profile) return jsonError("Sesi admin/petugas tidak valid.", 401);
        if (requireAdmin(session.profile)) return jsonError("Hanya admin yang dapat menghapus data warga.", 403);

        const id = new URL(request.url).searchParams.get("id");
        if (!id) return jsonError("ID warga wajib diisi.");

        const supabase = createSupabaseAdminClient();
        const { data: warga, error: wargaError } = await supabase.from("warga_profiles").select("id,nik,role").eq("id", id).maybeSingle();
        if (wargaError) return jsonError(wargaError.message, 500);
        if (!warga) return jsonError("Data warga tidak ditemukan.", 404);
        if (warga.role && warga.role !== "warga") return jsonError("Data petugas/admin tidak boleh dihapus dari modul warga.", 403);

        const { count, error: countError } = await supabase.from("pengajuan_surat").select("id", { count: "exact", head: true }).eq("nik", warga.nik);
        if (countError) return jsonError(countError.message, 500);
        if ((count ?? 0) > 0) {
            const { data, error } = await supabase.from("warga_profiles").update({ status_verifikasi: "Ditolak", alasan_penolakan: "Akun dinonaktifkan admin karena memiliki histori pengajuan surat." }).eq("id", id).select(WARGA_SELECT).single();
            if (error) return jsonError(error.message, 500);
            return NextResponse.json({ ok: true, softDeleted: true, data });
        }

        const { error } = await supabase.from("warga_profiles").delete().eq("id", id);
        if (error) return jsonError(error.message, 500);
        return NextResponse.json({ ok: true, deleted: true });
    } catch (error) {
        console.error("[api/admin/verifikasi:DELETE]", error);
        return jsonError(error instanceof Error ? error.message : "Gagal menghapus data warga.", 500);
    }
}
