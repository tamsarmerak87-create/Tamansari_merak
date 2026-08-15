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

export type VerifikasiPengajuan = {
    id?: string;
    pengajuan_id?: string;
    tahap?: number | null;
    nama_tahap?: string | null;
    role_petugas?: string | null;
    status?: string | null;
    nama_petugas?: string | null;
    catatan?: string | null;
    hasil_verifikasi?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    acted_at?: string | null;
    approved_at?: string | null;
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
    verifikasi_pengajuan?: VerifikasiPengajuan[];
};

export type WargaFavorit = { id: string; warga_id: string; layanan_id: string; created_at?: string | null; layanan?: { id: string; nama?: string | null; deskripsi?: string | null } | null };

type WargaPengajuanApiResponse = {
    ok?: boolean;
    data?: WargaPengajuan[];
    error?: string;
};

type WargaPengajuanDetailApiResponse = {
    ok?: boolean;
    data?: WargaPengajuan;
    error?: string;
};

type WargaNotificationRow = {
    id: string;
    title?: string | null;
    message?: string | null;
    catatan?: string | null;
    type?: WargaNotification["type"] | null;
    read?: boolean | null;
    created_at?: string | null;
    pengajuan_id?: string | null;
};

function client() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) throw new Error("Supabase env belum dikonfigurasi.");
    return supabase;
}

const DOKUMEN_BUCKET = "surat";
let favoritTableAvailable: boolean | null = null;

function logDokumenPath(label: string, meta: Record<string, unknown>) {
    if (process.env.NODE_ENV === "production") return;
    console.info(label, meta);
}

export function normalizeSuratObjectPath(pathOrUrl?: string | null) {
    const value = pathOrUrl?.trim();
    if (!value) return "";
    if (!/^https?:\/\//i.test(value)) return value.replace(/^\/+/, "").replace(/^surat\//, "");
    try {
        const url = new URL(value);
        const marker = `/storage/v1/object/public/${DOKUMEN_BUCKET}/`;
        const publicIndex = url.pathname.indexOf(marker);
        if (publicIndex >= 0) return decodeURIComponent(url.pathname.slice(publicIndex + marker.length)).replace(/^surat\//, "");
        const signedMarker = `/storage/v1/object/sign/${DOKUMEN_BUCKET}/`;
        const signedIndex = url.pathname.indexOf(signedMarker);
        if (signedIndex >= 0) return decodeURIComponent(url.pathname.slice(signedIndex + signedMarker.length)).replace(/^surat\//, "");
        const objectIndex = value.indexOf(`/object/${DOKUMEN_BUCKET}/`);
        if (objectIndex >= 0) return decodeURIComponent(value.slice(objectIndex + `/object/${DOKUMEN_BUCKET}/`.length)).replace(/^surat\//, "");
        return decodeURIComponent(value).replace(/^\/+/, "").replace(/^surat\//, "");
    } catch {
        return "";
    }
    return "";
}

export async function getCurrentWargaProfile() {
    return getCurrentWarga();
}

export async function getMyPengajuan(profileInput?: WargaProfile | null) {
    const profile = profileInput ?? (await getCurrentWargaProfile()).profile;
    if (!profile?.nik) return [];

    const { data: sessionData, error: sessionError } = await client().auth.getSession();
    if (sessionError) throw sessionError;
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error("Silakan login terlebih dahulu.");

    const response = await fetch("/api/warga/pengajuan", {
        method: "GET",
        headers: { authorization: `Bearer ${accessToken}` },
        cache: "no-store",
    });
    const result = await response.json().catch(() => null) as WargaPengajuanApiResponse | null;
    if (!response.ok || !result?.ok) throw new Error(result?.error || "Gagal memuat data pengajuan warga.");
    return result.data ?? [];
}

export async function getMyPengajuanDetail(id: string, profileInput?: WargaProfile | null) {
    void profileInput;
    const { data: sessionData, error: sessionError } = await client().auth.getSession();
    if (sessionError) throw sessionError;
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error("Silakan login terlebih dahulu.");

    const response = await fetch(`/api/warga/pengajuan/${encodeURIComponent(id)}`, {
        method: "GET",
        headers: { authorization: `Bearer ${accessToken}` },
        cache: "no-store",
    });
    const result = await response.json().catch(() => null) as WargaPengajuanDetailApiResponse | null;
    if (response.status === 404 || response.status === 403) return null;
    if (!response.ok || !result?.ok) throw new Error(result?.error || "Gagal memuat detail pengajuan warga.");
    return result.data ?? null;
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
    return true;
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
    const tracking = items.flatMap((item) => (item.tracking_pengajuan ?? []).map((track) => ({
        id: `tracking-${track.id ?? item.id}-${track.created_at ?? ""}`,
        title: track.status ? `Status ${track.status}` : "Update Pengajuan",
        message: track.keterangan || statusMessage(track.status || item.status),
        type: "pengajuan" as const,
        read: true,
        created_at: track.created_at,
        pengajuan_id: item.id,
    })));
    const verifikasi = items.flatMap((item) => (item.verifikasi_pengajuan ?? []).filter((stage) => stage.status && stage.status !== "Menunggu").map((stage) => ({
        id: `verifikasi-${stage.id ?? item.id}-${stage.updated_at ?? stage.acted_at ?? ""}`,
        title: `Verifikasi ${stage.status}`,
        message: `${stage.nama_tahap ?? "Tahap verifikasi"}: ${stage.catatan || stage.hasil_verifikasi || statusMessage(stage.status)}`,
        type: "pengajuan" as const,
        read: true,
        created_at: stage.acted_at ?? stage.approved_at ?? stage.updated_at ?? stage.created_at,
        pengajuan_id: item.id,
    })));
    const dokumen = items.flatMap((item) => (item.dokumen_pengajuan ?? []).map((doc) => ({
        id: `dokumen-${doc.id ?? item.id}-${doc.created_at ?? ""}`,
        title: doc.jenis ? `Dokumen ${doc.jenis}` : "Dokumen Pengajuan",
        message: `${doc.nama_file || "Dokumen"} untuk ${item.nomor_pengajuan ?? "pengajuan"} tersedia.`,
        type: "dokumen" as const,
        read: true,
        created_at: doc.created_at ?? item.updated_at ?? item.created_at,
        pengajuan_id: item.id,
    })));
    return [...tracking, ...verifikasi, ...dokumen].sort((a, b) => new Date(b.created_at ?? "").getTime() - new Date(a.created_at ?? "").getTime());
}

export async function getMyNotifikasi(pengajuan?: WargaPengajuan[]) {
    void pengajuan;
    const { user } = await getCurrentWargaProfile();
    if (!user) throw new Error("Silakan login terlebih dahulu.");
    const { data, error } = await client().from("warga_notifikasi").select("id,title,message,catatan,type,read,created_at,pengajuan_id").eq("warga_id", user.id).order("created_at", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as WargaNotificationRow[]).map((item) => ({
        id: item.id,
        title: item.title || "Notifikasi",
        message: item.catatan ? `${item.message ?? ""}\nCatatan: ${item.catatan}` : item.message || "-",
        type: item.type ?? "pengajuan",
        read: Boolean(item.read),
        created_at: item.created_at,
        pengajuan_id: item.pengajuan_id,
    }));
}

export async function markNotificationRead(id: string) {
    const { user } = await getCurrentWargaProfile();
    if (!user) throw new Error("Silakan login terlebih dahulu.");
    const { error } = await client().from("warga_notifikasi").update({ read: true }).eq("id", id).eq("warga_id", user.id);
    if (error) throw error;
}

export async function markAllNotificationsRead() {
    const { user } = await getCurrentWargaProfile();
    if (!user) throw new Error("Silakan login terlebih dahulu.");
    const { error } = await client().from("warga_notifikasi").update({ read: true }).eq("warga_id", user.id).eq("read", false);
    if (error) throw error;
}

export async function deleteNotification(id: string) {
    const { user } = await getCurrentWargaProfile();
    if (!user) throw new Error("Silakan login terlebih dahulu.");
    const { error } = await client().from("warga_notifikasi").delete().eq("id", id).eq("warga_id", user.id);
    if (error) throw error;
}

export function getMyDocumentsFromPengajuan(items: WargaPengajuan[]) {
    return items.flatMap((item) => (item.dokumen_pengajuan ?? []).map((doc) => ({
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
    logDokumenPath("UPLOAD PATH", { bucket: DOKUMEN_BUCKET, path: upload.data.path, plannedPath: path, fileName: file.name });
    return { url_file: upload.data.path, nama_file: file.name, jenis };
}

export function getDokumenUrl(pathOrUrl?: string | null) {
    const path = normalizeSuratObjectPath(pathOrUrl);
    logDokumenPath("READ PATH", { bucket: DOKUMEN_BUCKET, databasePath: pathOrUrl ?? null, path });
    if (!path) return "";
    return client().storage.from(DOKUMEN_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function debugListSuratFolder(folder: string) {
    if (process.env.NODE_ENV === "production") return [];
    const { data, error } = await client().storage.from(DOKUMEN_BUCKET).list(folder);
    if (error) throw error;
    return data ?? [];
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