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
    nomor_tiket?: string | null;
    nik?: string | null;
    nama_lengkap?: string | null;
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
    dokumen_pengajuan?: { nama_file?: string | null; jenis?: string | null; url_file?: string | null }[];
};

export type WargaFavorit = { id: string; warga_id: string; layanan_id: string; created_at?: string | null; layanan?: { id: string; nama?: string | null; deskripsi?: string | null } | null };

function client() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) throw new Error("Supabase env belum dikonfigurasi.");
    return supabase;
}

function normalizeRows(rows: WargaPengajuan[] | null | undefined) {
    return (rows ?? []).map((row) => ({
        ...row,
        layanan: row.layanan ?? { nama: "Nama layanan tidak tersedia" },
        tracking_pengajuan: [...(row.tracking_pengajuan ?? [])].sort((a, b) => new Date(a.created_at ?? "").getTime() - new Date(b.created_at ?? "").getTime()),
    }));
}

const pengajuanSelect = "id,nomor_pengajuan,nomor_tiket,nik,nama_lengkap,layanan_id,keperluan,status,created_at,updated_at,file_ktp,file_kk,file_pendukung, layanan:layanan_id(id,nama), tracking_pengajuan(id,pengajuan_id,status,keterangan,petugas,created_at), dokumen_pengajuan(*)";

async function attachLayananFallback(rows: WargaPengajuan[]) {
    const missing = rows.filter((row) => !row.layanan?.nama && row.layanan_id).map((row) => row.layanan_id as string);
    if (missing.length === 0) return normalizeRows(rows);

    const { data } = await client().from("layanan").select("id,nama").in("id", [...new Set(missing)]);
    const layananById = new Map((data ?? []).map((item) => [item.id, item]));
    return normalizeRows(rows.map((row) => ({ ...row, layanan: row.layanan?.nama ? row.layanan : layananById.get(row.layanan_id ?? "") ?? null })));
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
        .select(pengajuanSelect)
        .eq("nik", profile.nik)
        .order("created_at", { ascending: false });

    console.log("[PENGAJUAN RESULT]", { count: data?.length, data, error });
    if (error) throw error;
    return attachLayananFallback(data as WargaPengajuan[]);
}

export async function getMyPengajuanDetail(id: string) {
    const { profile } = await getCurrentWargaProfile();
    if (!profile?.nik) return null;
    console.log("[PENGAJUAN QUERY]", { nik: profile.nik, id });

    const { data, error } = await client()
        .from("pengajuan_surat")
        .select(pengajuanSelect)
        .eq("id", id)
        .eq("nik", profile.nik)
        .maybeSingle();

    console.log("[PENGAJUAN RESULT]", { count: data ? 1 : 0, data, error });
    if (error) throw error;
    if (!data) return null;
    return (await attachLayananFallback([data as WargaPengajuan]))[0] ?? null;
}

export async function getMyFavorit() {
    const { user } = await getCurrentWargaProfile();
    if (!user) return [];
    const { data, error } = await client().from("warga_favorit").select("id,warga_id,layanan_id,created_at,layanan:layanan_id(id,nama,deskripsi)").eq("warga_id", user.id).order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as WargaFavorit[];
}