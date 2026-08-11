import { createSupabaseBrowserClient } from "@/services/supabase";
import type { WargaProfile } from "@/services/warga-auth.service";
import { getCurrentWarga } from "@/services/warga-auth.service";

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
    nomor_pengajuan?: string | null;
    status?: string | null;
};

export type WargaNotification = {
    id: string;
    title: string;
    message: string;
    type: "pengajuan" | "dokumen" | "profil" | "system";
    read: boolean;
    created_at?: string | null;
    pengajuan_id?: string | null;
};

export type WargaDashboardData = {
    profile: WargaProfile | null;
    pengajuan: WargaPengajuan[];
    notifikasi: WargaNotification[];
    dokumen: DokumenPengajuan[];
    favorit: WargaFavorit[];
    fitur: { favoritAvailable: boolean; notifikasiAvailable: boolean };
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
let notifikasiTableAvailable: boolean | null = null;

function normalizeRows(rows: WargaPengajuan[] | null | undefined, layananById = new Map<string, { id?: string; nama?: string | null; deskripsi?: string | null }>(), trackingByPengajuanId = new Map<string, TrackingPengajuan[]>(), dokumenByPengajuanId = new Map<string, DokumenPengajuan[]>()) {
    return (rows ?? []).map((row) => ({
        ...row,
        layanan: row.layanan ?? layananById.get(row.layanan_id ?? "") ?? { nama: "Nama layanan tidak tersedia" },
        tracking_pengajuan: [...(row.tracking_pengajuan ?? trackingByPengajuanId.get(row.id) ?? [])].sort((a, b) => new Date(a.created_at ?? "").getTime() - new Date(b.created_at ?? "").getTime()),
        dokumen_pengajuan: [...(row.dokumen_pengajuan ?? dokumenByPengajuanId.get(row.id) ?? [])].sort((a, b) => new Date(b.created_at ?? "").getTime() - new Date(a.created_at ?? "").getTime()),
    }));
}

async function hydrateRows(rows: WargaPengajuan[], profile?: WargaProfile | null) {
    const supabase = client();
    const layananIds = [...new Set(rows.map((row) => row.layanan_id).filter(Boolean))] as string[];
    const pengajuanIds = rows.map((row) => row.id).filter(Boolean);
    const pengajuanMap = new Map(rows.map((item) => [item.id, item]));
    const layananById = new Map<string, { id?: string; nama?: string | null; deskripsi?: string | null }>();
    const trackingByPengajuanId = new Map<string, TrackingPengajuan[]>();
    const dokumenByPengajuanId = new Map<string, DokumenPengajuan[]>();

    if (layananIds.length > 0) {
        const { data, error } = await supabase.from("layanan").select("id,nama,deskripsi").in("id", layananIds);
        if (error) throw error;
        (data ?? []).forEach((item) => layananById.set(item.id, item));
    }

    if (pengajuanIds.length > 0) {
        const { data, error } = await supabase.from("tracking_pengajuan").select(TRACKING_COLUMNS).in("pengajuan_id", pengajuanIds).order("created_at", { ascending: true });
        if (error) throw error;
        ((data ?? []) as TrackingPengajuan[]).forEach((track) => {
            const key = track.pengajuan_id ?? "";
            trackingByPengajuanId.set(key, [...(trackingByPengajuanId.get(key) ?? []), track]);
        });

        const { data: dokumen, error: dokumenError } = await supabase.from("dokumen_pengajuan").select(DOKUMEN_COLUMNS).in("pengajuan_id", pengajuanIds).order("created_at", { ascending: false });
        if (dokumenError) throw dokumenError;
        ((dokumen ?? []) as DokumenPengajuan[]).map((doc) => ({
            ...doc,
            nomor_pengajuan: pengajuanMap.get(doc.pengajuan_id ?? "")?.nomor_pengajuan ?? "-",
            status: pengajuanMap.get(doc.pengajuan_id ?? "")?.status ?? "-",
        })).forEach((doc) => {
            const key = doc.pengajuan_id ?? "";
            dokumenByPengajuanId.set(key, [...(dokumenByPengajuanId.get(key) ?? []), doc]);
        });
    }

    return normalizeRows(rows, layananById, trackingByPengajuanId, dokumenByPengajuanId);
}

export async function getCurrentWargaProfile() {
    return getCurrentWarga();
}

export async function getMyPengajuan(profileInput?: WargaProfile | null) {
    const profile = profileInput ?? (await getCurrentWargaProfile()).profile;
    if (!profile?.nik) return [];

    const { data, error } = await client()
        .from("pengajuan_surat")
        .select(PENGAJUAN_COLUMNS)
        .eq("nik", profile.nik)
        .order("created_at", { ascending: false });

    if (error) throw error;
    return hydrateRows(data as WargaPengajuan[], profile);
}

export async function getMyPengajuanDetail(id: string, profileInput?: WargaProfile | null) {
    const profile = profileInput ?? (await getCurrentWargaProfile()).profile;
    if (!profile?.nik) return null;

    const { data, error } = await client()
        .from("pengajuan_surat")
        .select(PENGAJUAN_COLUMNS)
        .eq("id", id)
        .eq("nik", profile.nik)
        .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return (await hydrateRows([data as WargaPengajuan], profile))[0] ?? null;
}

export async function getMyFavorit(userId?: string | null) {
    if (favoritTableAvailable === false) return [];
    const resolvedUserId = userId ?? (await getCurrentWargaProfile()).user?.id;
    if (!resolvedUserId) return [];
    const { data, error } = await client().from("warga_favorit").select("id,warga_id,layanan_id,created_at,layanan:layanan_id(id,nama,deskripsi)").eq("warga_id", resolvedUserId).order("created_at", { ascending: false });
    if (error?.code === "42P01" || error?.message?.toLowerCase().includes("could not find the table")) {
        favoritTableAvailable = false;
        return [];
    }
    if (error) throw error;
    favoritTableAvailable = true;
    return (data ?? []) as unknown as WargaFavorit[];
}

export function isFavoritAvailable() {
    return favoritTableAvailable !== false;
}

export function isNotifikasiAvailable() {
    return notifikasiTableAvailable !== false;
}

export async function addMyFavorit(layananId: string) {
    if (favoritTableAvailable === false) return { available: false };
    const { user } = await getCurrentWargaProfile();
    if (!user) throw new Error("Silakan login terlebih dahulu.");
    const { error } = await client().from("warga_favorit").insert({ warga_id: user.id, layanan_id: layananId });
    if (error?.code === "42P01" || error?.message?.toLowerCase().includes("could not find the table")) {
        favoritTableAvailable = false;
        return { available: false };
    }
    if (error) throw error;
    favoritTableAvailable = true;
    return { available: true };
}

export async function removeMyFavorit(id: string) {
    if (favoritTableAvailable === false) return;
    const { user } = await getCurrentWargaProfile();
    if (!user) throw new Error("Silakan login terlebih dahulu.");
    const { error } = await client().from("warga_favorit").delete().eq("id", id).eq("warga_id", user.id);
    if (error) throw error;
}

function statusMessage(status?: string | null) {
    const value = (status ?? "").toLowerCase();
    if (value.includes("tolak")) return "Pengajuan Anda ditolak. Periksa keterangan terbaru.";
    if (value.includes("setuju")) return "Pengajuan Anda telah disetujui.";
    if (value.includes("verifikasi")) return "Pengajuan Anda sedang diverifikasi.";
    if (value.includes("selesai")) return "Pengajuan Anda telah selesai.";
    return "Pengajuan Anda sedang diproses.";
}

export function buildTrackingNotifications(items: WargaPengajuan[]) {
    return items.flatMap((item) => (item.tracking_pengajuan ?? []).map((track) => ({
        id: `tracking-${track.id ?? item.id}-${track.created_at ?? ""}`,
        title: track.status ? `Status ${track.status}` : "Update Pengajuan",
        message: track.keterangan || statusMessage(track.status || item.status),
        type: "pengajuan" as const,
        read: true,
        created_at: track.created_at,
        pengajuan_id: item.id,
    }))).sort((a, b) => new Date(b.created_at ?? "").getTime() - new Date(a.created_at ?? "").getTime());
}

export async function getMyNotifikasi(pengajuan?: WargaPengajuan[]) {
    if (notifikasiTableAvailable === false) return buildTrackingNotifications(pengajuan ?? []);
    const { user } = await getCurrentWargaProfile();
    if (!user) return [];
    const { data, error } = await client().from("warga_notifikasi").select("id,judul,pesan,jenis,is_read,created_at,pengajuan_id").eq("warga_id", user.id).order("created_at", { ascending: false });
    if (error?.code === "42P01" || error?.message?.toLowerCase().includes("could not find the table")) {
        notifikasiTableAvailable = false;
        return buildTrackingNotifications(pengajuan ?? []);
    }
    if (error) throw error;
    notifikasiTableAvailable = true;
    return (data ?? []).map((item) => ({ id: item.id, title: item.judul ?? "Notifikasi", message: item.pesan ?? "Ada pembaruan data.", type: item.jenis ?? "system", read: Boolean(item.is_read), created_at: item.created_at, pengajuan_id: item.pengajuan_id })) as WargaNotification[];
}

export async function markNotificationRead(id: string) {
    if (notifikasiTableAvailable === false || id.startsWith("tracking-")) return;
    const { user } = await getCurrentWargaProfile();
    if (!user) throw new Error("Silakan login terlebih dahulu.");
    const { error } = await client().from("warga_notifikasi").update({ is_read: true }).eq("id", id).eq("warga_id", user.id);
    if (error) throw error;
}

export async function markAllNotificationsRead() {
    if (notifikasiTableAvailable === false) return;
    const { user } = await getCurrentWargaProfile();
    if (!user) throw new Error("Silakan login terlebih dahulu.");
    const { error } = await client().from("warga_notifikasi").update({ is_read: true }).eq("warga_id", user.id).eq("is_read", false);
    if (error) throw error;
}

export async function deleteNotification(id: string) {
    if (notifikasiTableAvailable === false || id.startsWith("tracking-")) return;
    const { user } = await getCurrentWargaProfile();
    if (!user) throw new Error("Silakan login terlebih dahulu.");
    const { error } = await client().from("warga_notifikasi").delete().eq("id", id).eq("warga_id", user.id);
    if (error) throw error;
}

export function getMyDocumentsFromPengajuan(items: WargaPengajuan[]) {
    return items.flatMap((item) => (item.dokumen_pengajuan ?? []).filter((doc) => Boolean(doc.url_file)).map((doc) => ({
        ...doc,
        nomor_pengajuan: doc.nomor_pengajuan ?? item.nomor_pengajuan ?? "-",
        status: doc.status ?? item.status ?? "-",
        created_at: doc.created_at ?? item.created_at,
    })));
}

export async function uploadMyDokumen(file: File, jenis = "Dokumen Pendukung") {
    if (!file || file.size === 0) throw new Error("File kosong.");
    if (file.size > 5 * 1024 * 1024) throw new Error("Ukuran file terlalu besar.");
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) throw new Error("Format file belum didukung.");
    const { user, profile } = await getCurrentWargaProfile();
    if (!user || !profile?.nik) throw new Error("Silakan login terlebih dahulu.");
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80);
    const path = `warga/${user.id}/${Date.now()}-${safeName || `dokumen.${ext}`}`;
    const supabase = client();
    const upload = await supabase.storage.from("surat").upload(path, file, { upsert: false, contentType: file.type });
    if (upload.error) throw upload.error;
    return { url_file: supabase.storage.from("surat").getPublicUrl(path).data.publicUrl, nama_file: file.name, jenis };
}

export async function getWargaDashboardData(): Promise<WargaDashboardData> {
    const { user, profile } = await getCurrentWargaProfile();
    const pengajuan = await getMyPengajuan(profile);
    const [favorit, notifikasi] = await Promise.all([
        getMyFavorit(user?.id).catch(() => []),
        getMyNotifikasi(pengajuan).catch(() => buildTrackingNotifications(pengajuan)),
    ]);
    return { profile, pengajuan, notifikasi, dokumen: getMyDocumentsFromPengajuan(pengajuan), favorit, fitur: { favoritAvailable: isFavoritAvailable(), notifikasiAvailable: isNotifikasiAvailable() } };
}