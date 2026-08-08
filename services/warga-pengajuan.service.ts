import { createSupabaseBrowserClient } from "@/services/supabase";
import type { WargaProfile } from "@/services/warga-auth.service";

export type TrackingPengajuan = {
    id?: string;
    pengajuan_id?: string;
    status?: string | null;
    keterangan?: string | null;
    petugas?: string | null;
    created_at?: string | null;
};

export type DokumenPengajuan = {
    id?: string;
    pengajuan_id?: string | null;
    nama_file?: string | null;
    jenis?: string | null;
    url_file?: string | null;
    created_at?: string | null;
};

export type WargaPengajuan = {
    id: string;
    nomor_pengajuan?: string | null;
    nik?: string | null;
    nomor_kk?: string | null;
    nama_lengkap?: string | null;
    tempat_lahir?: string | null;
    tanggal_lahir?: string | null;
    jenis_kelamin?: string | null;
    agama?: string | null;
    status_perkawinan?: string | null;
    pekerjaan?: string | null;
    alamat?: string | null;
    rt?: string | null;
    rw?: string | null;
    kelurahan?: string | null;
    kecamatan?: string | null;
    no_hp?: string | null;
    email?: string | null;
    layanan_id?: string | null;
    keperluan?: string | null;
    catatan?: string | null;
    status?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    alasan_penolakan?: string | null;
    verified_at?: string | null;
    verified_by?: string | null;
    diproses_at?: string | null;
    diproses_by?: string | null;
    selesai_at?: string | null;
    selesai_by?: string | null;
    catatan_admin?: string | null;
    file_ktp?: string | null;
    file_kk?: string | null;
    file_pendukung?: string | null;
    layanan?: { id?: string; nama?: string | null; deskripsi?: string | null } | null;
    tracking_pengajuan?: TrackingPengajuan[];
    dokumen_pengajuan?: DokumenPengajuan[];
};

export type WargaFavorit = { id: string; warga_id: string; layanan_id: string; created_at?: string | null; layanan?: { id: string; nama?: string | null; deskripsi?: string | null } | null };

function client() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) throw new Error("Supabase env belum dikonfigurasi.");
    return supabase;
}

const PENGAJUAN_COLUMNS = "id,nomor_pengajuan,nik,nomor_kk,nama_lengkap,tempat_lahir,tanggal_lahir,jenis_kelamin,agama,status_perkawinan,pekerjaan,alamat,rt,rw,kelurahan,kecamatan,no_hp,email,layanan_id,keperluan,catatan,file_ktp,file_kk,file_pendukung,status,created_at,updated_at,alasan_penolakan,verified_at,verified_by,diproses_at,diproses_by,selesai_at,selesai_by,catatan_admin";
const TRACKING_COLUMNS = "id,pengajuan_id,status,keterangan,petugas,created_at";
const DOKUMEN_COLUMNS = "id,pengajuan_id,nama_file,jenis,url_file,created_at";
let favoritTableAvailable: boolean | null = null;

function normalizeRows(rows: WargaPengajuan[] | null | undefined, layananById = new Map<string, { id?: string; nama?: string | null; deskripsi?: string | null }>(), trackingByPengajuanId = new Map<string, TrackingPengajuan[]>(), dokumenByPengajuanId = new Map<string, DokumenPengajuan[]>()) {
    return (rows ?? []).map((row) => ({
        ...row,
        layanan: row.layanan ?? layananById.get(row.layanan_id ?? "") ?? { nama: "Nama layanan tidak tersedia" },
        tracking_pengajuan: [...(row.tracking_pengajuan ?? trackingByPengajuanId.get(row.id) ?? [])].sort((a, b) => new Date(a.created_at ?? "").getTime() - new Date(b.created_at ?? "").getTime()),
        dokumen_pengajuan: [...(row.dokumen_pengajuan ?? dokumenByPengajuanId.get(row.id) ?? [])].sort((a, b) => new Date(b.created_at ?? "").getTime() - new Date(a.created_at ?? "").getTime()),
    }));
}

async function hydrateRows(rows: WargaPengajuan[]) {
    const supabase = client();
    const layananIds = [...new Set(rows.map((row) => row.layanan_id).filter(Boolean))] as string[];
    const pengajuanIds = rows.map((row) => row.id).filter(Boolean);
    const layananById = new Map<string, { id?: string; nama?: string | null; deskripsi?: string | null }>();
    const trackingByPengajuanId = new Map<string, TrackingPengajuan[]>();
    const dokumenByPengajuanId = new Map<string, DokumenPengajuan[]>();

    if (layananIds.length > 0) {
        const { data, error } = await supabase.from("layanan").select("id,nama,deskripsi").in("id", layananIds);
        if (error) console.error("[DASHBOARD WARGA]", error);
        (data ?? []).forEach((item) => layananById.set(item.id, item));
    }

    if (pengajuanIds.length > 0) {
        const { data, error } = await supabase.from("tracking_pengajuan").select(TRACKING_COLUMNS).in("pengajuan_id", pengajuanIds).order("created_at", { ascending: true });
        if (error) console.error("[DASHBOARD WARGA]", error);
        ((data ?? []) as TrackingPengajuan[]).forEach((track) => {
            const key = track.pengajuan_id ?? "";
            trackingByPengajuanId.set(key, [...(trackingByPengajuanId.get(key) ?? []), track]);
        });

        const { data: dokumen, error: dokumenError } = await supabase.from("dokumen_pengajuan").select(DOKUMEN_COLUMNS).in("pengajuan_id", pengajuanIds).order("created_at", { ascending: false });
        console.log("[DOKUMEN ERROR]", dokumenError);
        console.log("[DOKUMEN PENGAJUAN]", dokumen);
        if (dokumenError) console.error("[DOKUMEN ERROR]", dokumenError);
        ((dokumen ?? []) as DokumenPengajuan[]).forEach((doc) => {
            const key = doc.pengajuan_id ?? "";
            dokumenByPengajuanId.set(key, [...(dokumenByPengajuanId.get(key) ?? []), doc]);
        });
    }

    return normalizeRows(rows, layananById, trackingByPengajuanId, dokumenByPengajuanId);
}

export async function getCurrentWargaProfile() {
    const supabase = client();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    const user = userData.user;
    if (!user) return { user: null, profile: null };

    const { data: profile, error } = await supabase.from("warga_profiles").select("*").eq("id", user.id).maybeSingle();
    if (error) throw error;
    return { user, profile: profile as WargaProfile | null };
}

export async function getMyPengajuan() {
    const { profile } = await getCurrentWargaProfile();
    if (!profile?.nik) return [];

    const { data, error } = await client()
        .from("pengajuan_surat")
        .select(PENGAJUAN_COLUMNS)
        .eq("nik", profile.nik)
        .order("created_at", { ascending: false });

    if (error) throw error;
    console.log("[PENGAJUAN WARGA]", data);
    return hydrateRows(data as WargaPengajuan[]);
}

export async function getMyPengajuanDetail(id: string) {
    const { profile } = await getCurrentWargaProfile();
    if (!profile?.nik) return null;

    const { data, error } = await client()
        .from("pengajuan_surat")
        .select(PENGAJUAN_COLUMNS)
        .eq("id", id)
        .eq("nik", profile.nik)
        .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return (await hydrateRows([data as WargaPengajuan]))[0] ?? null;
}

export async function getMyFavorit() {
    if (favoritTableAvailable === false) return [];
    const { user } = await getCurrentWargaProfile();
    if (!user) return [];
    const { data, error } = await client().from("warga_favorit").select("id,warga_id,layanan_id,created_at,layanan:layanan_id(id,nama,deskripsi)").eq("warga_id", user.id).order("created_at", { ascending: false });
    if (error?.code === "42P01" || error?.message?.toLowerCase().includes("could not find the table")) {
        favoritTableAvailable = false;
        return [];
    }
    if (error) throw error;
    favoritTableAvailable = true;
    return (data ?? []) as unknown as WargaFavorit[];
}

export async function removeMyFavorit(id: string) {
    if (favoritTableAvailable === false) return;
    const { user } = await getCurrentWargaProfile();
    if (!user) throw new Error("Silakan login terlebih dahulu.");
    const { error } = await client().from("warga_favorit").delete().eq("id", id).eq("warga_id", user.id);
    if (error) throw error;
}