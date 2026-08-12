import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/services/supabase";
import type { WargaProfile } from "@/services/warga-auth.service";
import type { DokumenPengajuan, TrackingPengajuan, VerifikasiPengajuan, WargaPengajuan } from "@/services/warga-pengajuan.service";

type ValidatedWarga = { warga: WargaProfile | null } | { error: string; status: number };
type RouteContext = { params: Promise<{ id: string }> | { id: string } };

const WARGA_PROFILE_SAFE_COLUMNS = "id,nama_lengkap,nik,nomor_kk,email,nomor_hp,nomor_whatsapp,tempat_lahir,tanggal_lahir,jenis_kelamin,alamat,rt,rw,kelurahan,kecamatan,foto_url,role,status_verifikasi,alasan_penolakan,created_at,updated_at";
const PENGAJUAN_COLUMNS = "id,nomor_pengajuan,nik,nomor_kk,nama_lengkap,tempat_lahir,tanggal_lahir,jenis_kelamin,agama,status_perkawinan,pekerjaan,alamat,rt,rw,kelurahan,kecamatan,no_hp,email,layanan_id,keperluan,catatan,status,created_at,updated_at,alasan_penolakan,verified_at,verified_by,diproses_at,diproses_by,selesai_at,selesai_by,catatan_admin,file_ktp,file_kk,file_pendukung";
const TRACKING_COLUMNS = "id,pengajuan_id,status,keterangan,petugas,created_at";
const DOKUMEN_COLUMNS = "id,pengajuan_id,nama_file,jenis,url_file,created_at";
const VERIFIKASI_COLUMNS = "id,pengajuan_id,tahap,nama_tahap,role_petugas,status,nama_petugas,catatan,hasil_verifikasi,created_at,updated_at,acted_at,approved_at";

function jsonError(message: string, status = 400) {
    return NextResponse.json({ ok: false, error: message }, { status });
}

function logSupabaseError(label: string, error: unknown) {
    const supabaseError = error as { message?: string; code?: string; details?: string; hint?: string };
    console.error(label, {
        message: supabaseError.message ?? (error instanceof Error ? error.message : "Unknown error"),
        code: supabaseError.code,
        details: supabaseError.details,
        hint: supabaseError.hint,
    });
}

async function getValidatedWarga(request: NextRequest): Promise<ValidatedWarga> {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!token) return { error: "Silakan login terlebih dahulu.", status: 401 as const };

    const supabase = createSupabaseAdminClient();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return { error: "Session warga tidak valid.", status: 401 as const };

    const user = userData.user;
    const byId = await supabase.from("warga_profiles").select(WARGA_PROFILE_SAFE_COLUMNS).eq("id", user.id).maybeSingle<WargaProfile>();
    if (byId.error) throw byId.error;
    if (byId.data) return { warga: byId.data };

    const byEmail = await supabase.from("warga_profiles").select(WARGA_PROFILE_SAFE_COLUMNS).eq("email", user.email ?? "").maybeSingle<WargaProfile>();
    if (byEmail.error) throw byEmail.error;
    return { warga: byEmail.data ?? null };
}

function hydrateRows(rows: WargaPengajuan[], related: {
    layanan: Map<string, { id?: string; nama?: string | null; deskripsi?: string | null }>;
    tracking: Map<string, TrackingPengajuan[]>;
    dokumen: Map<string, DokumenPengajuan[]>;
    verifikasi: Map<string, VerifikasiPengajuan[]>;
}) {
    return rows.map((row) => ({
        ...row,
        layanan: row.layanan ?? related.layanan.get(row.layanan_id ?? "") ?? { nama: "Layanan tidak tersedia" },
        tracking_pengajuan: [...(related.tracking.get(row.id) ?? [])].sort((a, b) => new Date(a.created_at ?? "").getTime() - new Date(b.created_at ?? "").getTime()),
        dokumen_pengajuan: [...(related.dokumen.get(row.id) ?? [])].sort((a, b) => new Date(b.created_at ?? "").getTime() - new Date(a.created_at ?? "").getTime()),
        verifikasi_pengajuan: [...(related.verifikasi.get(row.id) ?? [])].sort((a, b) => (a.tahap ?? 0) - (b.tahap ?? 0)),
    }));
}

export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const { id } = await context.params;
        const validated = await getValidatedWarga(request);
        if ("error" in validated) return jsonError(validated.error, validated.status);
        const warga = validated.warga;
        if (!warga?.nik) return jsonError("Profil warga tidak ditemukan.", 404);

        const supabase = createSupabaseAdminClient();
        const { data: pengajuan, error } = await supabase
            .from("pengajuan_surat")
            .select(PENGAJUAN_COLUMNS)
            .eq("id", id)
            .maybeSingle<WargaPengajuan>();
        if (error) {
            logSupabaseError("DETAIL PENGAJUAN QUERY ERROR", error);
            throw error;
        }

        console.log("DETAIL PENGAJUAN", { pengajuanFound: Boolean(pengajuan), pengajuanId: id, ownerMatched: pengajuan?.nik === warga.nik });
        if (!pengajuan) return jsonError("Pengajuan tidak ditemukan.", 404);
        if (pengajuan.nik !== warga.nik) return jsonError("Pengajuan bukan milik akun warga yang sedang login.", 403);

        const [layananResult, trackingResult, dokumenResult, verifikasiResult] = await Promise.all([
            pengajuan.layanan_id ? supabase.from("layanan").select("id,nama,deskripsi").eq("id", pengajuan.layanan_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
            supabase.from("tracking_pengajuan").select(TRACKING_COLUMNS).eq("pengajuan_id", id).order("created_at", { ascending: true }),
            supabase.from("dokumen_pengajuan").select(DOKUMEN_COLUMNS).eq("pengajuan_id", id).order("created_at", { ascending: false }),
            supabase.from("verifikasi_pengajuan").select(VERIFIKASI_COLUMNS).eq("pengajuan_id", id).order("tahap", { ascending: true }),
        ]);

        if (layananResult.error) logSupabaseError("LAYANAN DETAIL QUERY ERROR", layananResult.error);
        if (trackingResult.error) logSupabaseError("TRACKING DETAIL QUERY ERROR", trackingResult.error);
        if (dokumenResult.error) logSupabaseError("DOKUMEN DETAIL QUERY ERROR", dokumenResult.error);
        if (verifikasiResult.error) logSupabaseError("VERIFIKASI DETAIL QUERY ERROR", verifikasiResult.error);

        return NextResponse.json({
            ok: true,
            data: {
                ...pengajuan,
                layanan: layananResult.error ? { nama: "Layanan tidak tersedia" } : layananResult.data ?? { nama: "Layanan tidak tersedia" },
                tracking_pengajuan: (trackingResult.error ? [] : trackingResult.data ?? []) as TrackingPengajuan[],
                dokumen_pengajuan: (dokumenResult.error ? [] : dokumenResult.data ?? []) as DokumenPengajuan[],
                verifikasi_pengajuan: (verifikasiResult.error ? [] : verifikasiResult.data ?? []) as VerifikasiPengajuan[],
            },
        });
    } catch (error) {
        console.error("GET /api/warga/pengajuan/[id] ERROR", error);
        const message = error instanceof Error ? error.message : "Gagal mengambil detail pengajuan warga.";
        return jsonError(message, 500);
    }
}