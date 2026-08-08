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
    status?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    file_ktp?: string | null;
    file_kk?: string | null;
    file_pendukung?: string | null;
    layanan?: { id?: string; nama?: string | null } | null;
    tracking_pengajuan?: TrackingPengajuan[];
};

export type WargaFavorit = { id: string; warga_id: string; layanan_id: string; created_at?: string | null; layanan?: { id: string; nama?: string | null; deskripsi?: string | null } | null };

function client() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) throw new Error("Supabase env belum dikonfigurasi.");
    return supabase;
}

const PENGAJUAN_COLUMNS = "id,nomor_pengajuan,nik,nomor_kk,nama_lengkap,tempat_lahir,tanggal_lahir,jenis_kelamin,agama,pekerjaan,alamat,rt,rw,kelurahan,kecamatan,no_hp,email,layanan_id,keperluan,status,created_at,updated_at,file_ktp,file_kk,file_pendukung";
const TRACKING_COLUMNS = "id,pengajuan_id,status,keterangan,petugas,created_at";

function normalizeRows(rows: WargaPengajuan[] | null | undefined, layananById = new Map<string, { id?: string; nama?: string | null }>(), trackingByPengajuanId = new Map<string, TrackingPengajuan[]>()) {
    return (rows ?? []).map((row) => ({
        ...row,
        layanan: row.layanan ?? layananById.get(row.layanan_id ?? "") ?? { nama: "Nama layanan tidak tersedia" },
        tracking_pengajuan: [...(row.tracking_pengajuan ?? trackingByPengajuanId.get(row.id) ?? [])].sort((a, b) => new Date(a.created_at ?? "").getTime() - new Date(b.created_at ?? "").getTime()),
    }));
}

async function hydrateRows(rows: WargaPengajuan[]) {
    const supabase = client();
    const layananIds = [...new Set(rows.map((row) => row.layanan_id).filter(Boolean))] as string[];
    const pengajuanIds = rows.map((row) => row.id).filter(Boolean);
    const layananById = new Map<string, { id?: string; nama?: string | null }>();
    const trackingByPengajuanId = new Map<string, TrackingPengajuan[]>();

    if (layananIds.length > 0) {
        const { data, error } = await supabase.from("layanan").select("id,nama").in("id", layananIds);
        if (error) console.error("[LAYANAN FALLBACK]", error);
        (data ?? []).forEach((item) => layananById.set(item.id, item));
    }

    if (pengajuanIds.length > 0) {
        const { data, error } = await supabase.from("tracking_pengajuan").select(TRACKING_COLUMNS).in("pengajuan_id", pengajuanIds).order("created_at", { ascending: true });
        if (error) console.error("[TRACKING PENGAJUAN]", error);
        ((data ?? []) as TrackingPengajuan[]).forEach((track) => {
            const key = track.pengajuan_id ?? "";
            trackingByPengajuanId.set(key, [...(trackingByPengajuanId.get(key) ?? []), track]);
        });
    }

    return normalizeRows(rows, layananById, trackingByPengajuanId);
}

export async function getCurrentWargaProfile() {
    const supabase = client();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    const user = userData.user;
    console.log("[WARGA AUTH]", { userId: user?.id });
    if (!user) return { user: null, profile: null };

    const { data: profile, error } = await supabase.from("warga_profiles").select("*").eq("id", user.id).maybeSingle();
    if (error) throw error;
    console.log("[WARGA PROFILE]", profile);
    console.log("[WARGA NIK]", profile?.nik);
    return { user, profile: profile as WargaProfile | null };
}

export async function getMyPengajuan() {
    const { profile } = await getCurrentWargaProfile();
    if (!profile?.nik) return [];
    console.log("[PENGAJUAN QUERY]", { nik: profile.nik });

    const { data, error } = await client()
        .from("pengajuan_surat")
        .select(PENGAJUAN_COLUMNS)
        .eq("nik", profile.nik)
        .order("created_at", { ascending: false });

    console.log("[PENGAJUAN RESULT]", { count: data?.length, data, error });
    if (error) throw error;
    return hydrateRows(data as WargaPengajuan[]);
}

export async function getMyPengajuanDetail(id: string) {
    const { profile } = await getCurrentWargaProfile();
    if (!profile?.nik) return null;
    console.log("[PENGAJUAN QUERY]", { nik: profile.nik, id });

    const { data, error } = await client()
        .from("pengajuan_surat")
        .select(PENGAJUAN_COLUMNS)
        .eq("id", id)
        .eq("nik", profile.nik)
        .maybeSingle();

    console.log("[PENGAJUAN RESULT]", { count: data ? 1 : 0, data, error });
    if (error) throw error;
    if (!data) return null;
    return (await hydrateRows([data as WargaPengajuan]))[0] ?? null;
}

export async function getMyFavorit() {
    const { user } = await getCurrentWargaProfile();
    if (!user) return [];
    const { data, error } = await client().from("warga_favorit").select("id,warga_id,layanan_id,created_at,layanan:layanan_id(id,nama,deskripsi)").eq("warga_id", user.id).order("created_at", { ascending: false });
    console.log("[FAVORIT]", { data, error });
    if (error?.code === "42P01" || error?.message?.toLowerCase().includes("could not find the table")) return [];
    if (error) throw error;
    return (data ?? []) as unknown as WargaFavorit[];
}