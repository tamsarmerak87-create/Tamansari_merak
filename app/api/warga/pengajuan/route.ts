import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/services/supabase";
import type { WargaProfile } from "@/services/warga-auth.service";
import type { DokumenPengajuan, TrackingPengajuan, VerifikasiPengajuan, WargaPengajuan } from "@/services/warga-pengajuan.service";

type ValidatedWarga = { warga: WargaProfile | null } | { error: string; status: number };

const WARGA_PROFILE_COLUMNS = "id,user_id,nama_lengkap,nik,nomor_kk,email,nomor_hp,nomor_whatsapp,tempat_lahir,tanggal_lahir,jenis_kelamin,alamat,rt,rw,kelurahan,kecamatan,foto_url,role,status_verifikasi,alasan_penolakan,created_at,updated_at";
const PENGAJUAN_COLUMNS = "id,nomor_pengajuan,nik,nomor_kk,nama_lengkap,tempat_lahir,tanggal_lahir,jenis_kelamin,agama,status_perkawinan,pekerjaan,alamat,rt,rw,kelurahan,kecamatan,no_hp,email,layanan_id,keperluan,catatan,file_ktp,file_kk,file_pendukung,status,created_at,updated_at,alasan_penolakan,verified_at,verified_by,diproses_at,diproses_by,selesai_at,selesai_by,catatan_admin";
const TRACKING_COLUMNS = "id,pengajuan_id,status,keterangan,petugas,created_at";
const DOKUMEN_COLUMNS = "id,pengajuan_id,nama_file,jenis,url_file,created_at";
const VERIFIKASI_COLUMNS = "id,pengajuan_id,tahap,nama_tahap,role_petugas,status,nama_petugas,catatan,hasil_verifikasi,created_at,updated_at,acted_at,approved_at";

function jsonError(message: string, status = 400) {
    return NextResponse.json({ ok: false, error: message }, { status });
}

async function getValidatedWarga(request: NextRequest): Promise<ValidatedWarga> {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!token) return { error: "Silakan login terlebih dahulu.", status: 401 as const };

    const supabase = createSupabaseAdminClient();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return { error: "Session warga tidak valid.", status: 401 as const };

    const user = userData.user;
    const byId = await supabase.from("warga_profiles").select(WARGA_PROFILE_COLUMNS).eq("id", user.id).maybeSingle<WargaProfile>();
    if (byId.error) throw byId.error;
    if (byId.data) return { warga: byId.data };

    const byUserId = await supabase.from("warga_profiles").select(WARGA_PROFILE_COLUMNS).eq("user_id", user.id).maybeSingle<WargaProfile>();
    if (byUserId.error && byUserId.error.code !== "42703") throw byUserId.error;
    if (byUserId.data) return { warga: byUserId.data };

    const byEmail = await supabase.from("warga_profiles").select(WARGA_PROFILE_COLUMNS).eq("email", user.email ?? "").maybeSingle<WargaProfile>();
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
        layanan: row.layanan ?? related.layanan.get(row.layanan_id ?? "") ?? { nama: "Nama layanan tidak tersedia" },
        tracking_pengajuan: [...(related.tracking.get(row.id) ?? [])].sort((a, b) => new Date(a.created_at ?? "").getTime() - new Date(b.created_at ?? "").getTime()),
        dokumen_pengajuan: [...(related.dokumen.get(row.id) ?? [])].sort((a, b) => new Date(b.created_at ?? "").getTime() - new Date(a.created_at ?? "").getTime()),
        verifikasi_pengajuan: [...(related.verifikasi.get(row.id) ?? [])].sort((a, b) => (a.tahap ?? 0) - (b.tahap ?? 0)),
    }));
}

export async function GET(request: NextRequest) {
    try {
        const validated = await getValidatedWarga(request);
        if ("error" in validated) return jsonError(validated.error, validated.status);
        const warga = validated.warga;
        if (!warga?.nik) return jsonError("Profil warga tidak ditemukan.", 404);

        const supabase = createSupabaseAdminClient();
        const { data, error } = await supabase
            .from("pengajuan_surat")
            .select(PENGAJUAN_COLUMNS)
            .eq("nik", warga.nik)
            .order("created_at", { ascending: false });
        if (error) throw error;

        const rows = (data ?? []) as WargaPengajuan[];
        const pengajuanIds = rows.map((row) => row.id).filter(Boolean);
        const layananIds = [...new Set(rows.map((row) => row.layanan_id).filter(Boolean))] as string[];
        const related = {
            layanan: new Map<string, { id?: string; nama?: string | null; deskripsi?: string | null }>(),
            tracking: new Map<string, TrackingPengajuan[]>(),
            dokumen: new Map<string, DokumenPengajuan[]>(),
            verifikasi: new Map<string, VerifikasiPengajuan[]>(),
        };

        if (layananIds.length > 0) {
            const { data: layanan, error: layananError } = await supabase.from("layanan").select("id,nama,deskripsi").in("id", layananIds);
            if (layananError) throw layananError;
            (layanan ?? []).forEach((item) => related.layanan.set(item.id, item));
        }

        if (pengajuanIds.length > 0) {
            const [trackingResult, dokumenResult, verifikasiResult] = await Promise.all([
                supabase.from("tracking_pengajuan").select(TRACKING_COLUMNS).in("pengajuan_id", pengajuanIds).order("created_at", { ascending: true }),
                supabase.from("dokumen_pengajuan").select(DOKUMEN_COLUMNS).in("pengajuan_id", pengajuanIds).order("created_at", { ascending: false }),
                supabase.from("verifikasi_pengajuan").select(VERIFIKASI_COLUMNS).in("pengajuan_id", pengajuanIds).order("tahap", { ascending: true }),
            ]);
            if (trackingResult.error) throw trackingResult.error;
            if (dokumenResult.error) throw dokumenResult.error;
            if (verifikasiResult.error) throw verifikasiResult.error;

            (trackingResult.data ?? []).forEach((track) => {
                const item = track as TrackingPengajuan;
                const key = item.pengajuan_id ?? "";
                related.tracking.set(key, [...(related.tracking.get(key) ?? []), item]);
            });
            (dokumenResult.data ?? []).forEach((doc) => {
                const item = doc as DokumenPengajuan;
                const key = item.pengajuan_id ?? "";
                related.dokumen.set(key, [...(related.dokumen.get(key) ?? []), item]);
            });
            (verifikasiResult.data ?? []).forEach((stage) => {
                const item = stage as VerifikasiPengajuan;
                const key = item.pengajuan_id ?? "";
                related.verifikasi.set(key, [...(related.verifikasi.get(key) ?? []), item]);
            });
        }

        const hydrated = hydrateRows(rows, related);
        console.log({ wargaFound: Boolean(warga), pengajuanCount: hydrated.length });

        return NextResponse.json({ ok: true, data: hydrated });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Gagal mengambil data pengajuan warga.";
        return jsonError(message, 500);
    }
}