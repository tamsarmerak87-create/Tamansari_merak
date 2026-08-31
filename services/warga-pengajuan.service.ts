import { createSupabaseBrowserClient } from "@/services/supabase";
import { compressWargaFile, MAX_WARGA_FILE_SIZE } from "@/services/warga-file-compress";
import type { WargaProfile } from "@/services/warga-auth.service";
import { getCurrentWarga } from "@/services/warga-auth.service";
import { normalizeSubmissionObjectPath, SUBMISSION_DOCUMENT_BUCKET } from "@/services/submission-storage";

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
    final_pdf_url?: string | null;
    metadata?: Record<string, unknown> | null;
    size?: number | null;
    file_size?: number | null;
};

export type DocumentManagementPolicy = "LOCKED_IDENTITY" | "MANAGEABLE" | "SERVICE_RESULT";

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
    status_pekerjaan?: string | null;
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
    workflow_status?: string | null;
    active_stage?: VerifikasiPengajuan | null;
    returned_to_role?: string | null;
    revision_note?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    alasan_penolakan?: string | null;
    verified_at?: string | null;
    verified_by?: string | null;
    diproses_at?: string | null;
    diproses_by?: string | null;
    selesai_at?: string | null;
    selesai_by?: string | null;
    final_pdf_url?: string | null;
    verification_token?: string | null;
    document_locked?: boolean | null;
    issued_at?: string | null;
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

export type RevisionDocumentInput = { nama_file: string; url_file: string; type: string; size: number };
export type RevisionSubmissionInput = Pick<WargaPengajuan, "keperluan" | "catatan" | "alamat" | "rt" | "rw" | "kelurahan" | "kecamatan" | "no_hp" | "email"> & { documents?: RevisionDocumentInput[]; deleted_document_ids?: string[] };

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

const DOKUMEN_BUCKET = SUBMISSION_DOCUMENT_BUCKET;
let favoritTableAvailable: boolean | null = null;

function logDokumenPath(label: string, meta: Record<string, unknown>) {
    if (process.env.NODE_ENV === "production") return;
    console.info(label, meta);
}

export function normalizeSuratObjectPath(pathOrUrl?: string | null) {
    return normalizeSubmissionObjectPath(pathOrUrl);
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

export async function getMySubmittedMemory(serviceId: string) {
    const { data: sessionData, error: sessionError } = await client().auth.getSession();
    if (sessionError) throw sessionError;
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error("Silakan login terlebih dahulu.");
    const response = await fetch(`/api/warga/pengajuan?memory_service_id=${encodeURIComponent(serviceId)}`, { headers: { authorization: `Bearer ${accessToken}` }, cache: "no-store" });
    const result = await response.json().catch(() => null) as { ok?: boolean; data?: Record<string, unknown> | null; error?: string } | null;
    if (!response.ok || !result?.ok) throw new Error(result?.error || "Gagal memuat data pengajuan sebelumnya.");
    return result.data ?? null;
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

async function wargaMutation(id: string, method: "PATCH" | "DELETE", body?: RevisionSubmissionInput) {
    const { data: sessionData, error: sessionError } = await client().auth.getSession();
    if (sessionError) throw sessionError;
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error("Silakan login terlebih dahulu.");
    const response = await fetch(`/api/warga/pengajuan/${encodeURIComponent(id)}`, {
        method,
        headers: { authorization: `Bearer ${accessToken}`, ...(body ? { "content-type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json().catch(() => null) as { ok?: boolean; error?: string; message?: string } | null;
    if (!response.ok || !result?.ok) throw new Error(result?.error || `Gagal ${method === "DELETE" ? "menghapus" : "mengirim ulang"} pengajuan.`);
    return result;
}

export function resubmitMyPengajuan(id: string, input: RevisionSubmissionInput) {
    return wargaMutation(id, "PATCH", input);
}

export function deleteMyPengajuan(id: string) {
    return wargaMutation(id, "DELETE");
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
    return items.flatMap((item) => (item.dokumen_pengajuan ?? []).filter(isWargaUploadedDocument).map((doc) => ({
        ...doc,
        nomor_pengajuan: doc.nomor_pengajuan ?? item.nomor_pengajuan ?? "-",
        status: doc.status ?? item.status ?? "-",
        created_at: doc.created_at ?? item.created_at,
    })));
}

export function isWargaUploadedDocument(doc: DokumenPengajuan) {
    const metadata = doc.metadata ?? {};
    const markers = [metadata.source, metadata.origin, metadata.document_type, metadata.category, metadata.type]
        .map((value) => String(value ?? "").trim().toUpperCase());
    const resultMarkers = ["PETUGAS", "SYSTEM", "GENERATED", "HASIL_PELAYANAN", "DOKUMEN_HASIL"];
    const generatedMetadataKeys = ["generated_by", "generated_at", "template_id", "issued_at", "signed_at", "verification_token", "pdf_path"];
    const status = String(doc.status ?? "").trim().toUpperCase();
    if (markers.some((value) => resultMarkers.includes(value))) return false;
    if (generatedMetadataKeys.some((key) => metadata[key] != null)) return false;
    return !["DRAFT", "SIAP_DIVERIFIKASI", "TERBIT", "GENERATED", "RESULT", "FINAL", "ISSUED", "HASIL_PELAYANAN"].includes(status);
}

export function isServiceResultDocument(doc: DokumenPengajuan) {
    const metadata = doc.metadata ?? {};
    const normalized = (value: unknown) => String(value ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
    const status = normalized(doc.status);
    const jenis = normalized(doc.jenis);
    const metadataMarkers = [metadata.source, metadata.origin, metadata.document_type, metadata.category, metadata.type].map(normalized);
    const hasPublicationMetadata = ["issued_at", "signed_at", "generated_at", "generated_by", "pdf_path", "verification_token", "verification_code", "verification_url"]
        .some((key) => metadata[key] != null);
    const isPublishedStatus = ["TERBIT", "SIGNED", "FINAL", "ISSUED", "GENERATED", "RESULT", "HASIL_PELAYANAN"].includes(status);
    const isResultType = /(^|_)SURAT_HASIL_PELAYANAN(?:_V\d+)?$/.test(jenis)
        || metadataMarkers.some((marker) => ["HASIL_PELAYANAN", "DOKUMEN_HASIL", "GENERATED", "SYSTEM", "PETUGAS"].includes(marker));
    return Boolean(doc.id && doc.pengajuan_id && doc.url_file) && (isPublishedStatus || isResultType || hasPublicationMetadata);
}

export function getDocumentManagementPolicy(doc: DokumenPengajuan): DocumentManagementPolicy {
    if (isServiceResultDocument(doc)) return "SERVICE_RESULT";
    const metadata = doc.metadata ?? {};
    const markers = [doc.jenis, metadata.document_type, metadata.category, metadata.identity_type]
        .map((value) => String(value ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_"));
    return markers.some((value) => ["KTP", "KK", "KARTU_KELUARGA", "IDENTITY_KTP", "IDENTITY_KK"].includes(value))
        ? "LOCKED_IDENTITY"
        : "MANAGEABLE";
}

export async function uploadMyDokumen(file: File, jenis = "Dokumen Pendukung") {
    if (!file || file.size === 0) throw new Error("File kosong.");
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) throw new Error("Format file belum didukung.");
    const processedFile = await compressWargaFile(file);
    if (processedFile.size > MAX_WARGA_FILE_SIZE) throw new Error("Ukuran file setelah kompresi masih lebih dari 1 MB.");
    const { user, profile } = await getCurrentWargaProfile();
    if (!user || !profile?.nik) throw new Error("Silakan login terlebih dahulu.");
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80);
    const path = `warga/${user.id}/${Date.now()}-${safeName || `dokumen.${ext}`}`;
    const supabase = client();
    const upload = await supabase.storage.from(DOKUMEN_BUCKET).upload(path, processedFile, { upsert: false, contentType: processedFile.type });
    if (upload.error) throw upload.error;
    logDokumenPath("UPLOAD PATH", { bucket: DOKUMEN_BUCKET, path: upload.data.path, plannedPath: path, fileName: file.name });
    return { url_file: upload.data.path, nama_file: processedFile.name, jenis };
}

async function documentMutation(id: string, method: "PATCH" | "DELETE", body?: FormData | { action: "rename"; display_name: string }) {
    const { data: sessionData, error: sessionError } = await client().auth.getSession();
    if (sessionError) throw sessionError;
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error("Silakan login terlebih dahulu.");
    const response = await fetch(`/api/warga/dokumen/${encodeURIComponent(id)}`, {
        method,
        headers: { authorization: `Bearer ${accessToken}`, ...(body && !(body instanceof FormData) ? { "content-type": "application/json" } : {}) },
        body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json().catch(() => null) as { ok?: boolean; error?: string; message?: string } | null;
    if (!response.ok || !result?.ok) throw new Error(result?.error || "Dokumen gagal diperbarui.");
    return result;
}

export function renameMyDocument(id: string, displayName: string) {
    return documentMutation(id, "PATCH", { action: "rename", display_name: displayName });
}

export function replaceMyDocument(id: string, file: File) {
    return compressWargaFile(file).then((processedFile) => {
        const body = new FormData();
        body.set("action", "replace");
        body.set("file", processedFile);
        return documentMutation(id, "PATCH", body);
    });
}

export function deleteMyDocument(id: string) {
    return documentMutation(id, "DELETE");
}

export function getWargaDokumenUrl(id?: string | null, download = false) {
    if (!id) return "";
    const query = new URLSearchParams({ _: String(Date.now()) });
    if (download) query.set("download", "1");
    return `/api/warga/dokumen/${encodeURIComponent(id)}?${query.toString()}`;
}

export type WargaDocumentType = "final-letter" | "supporting" | "unknown";

export async function accessWargaDokumen(id: string, download = false, documentType: WargaDocumentType = "unknown") {
    if (typeof window === "undefined") throw new Error("Dokumen warga hanya dapat diakses dari browser.");
    const endpoint = new URL(getWargaDokumenUrl(id, download), window.location.origin).href;
    const fetchDocument = async () => {
        const { data, error } = await client().auth.getSession();
        if (error) throw error;
        const token = data.session?.access_token;
        if (!token) throw new Error("Silakan login terlebih dahulu.");
        console.info("[WARGA DOCUMENT FETCH]", endpoint);
        try {
            const response = await fetch(endpoint, {
                method: "GET",
                headers: { authorization: `Bearer ${token}` },
                cache: "no-store",
                credentials: "same-origin",
            });
            console.info("[WARGA DOCUMENT FETCH STATUS]", response.status);
            return response;
        } catch (cause) {
            console.error("[WARGA DOCUMENT FETCH ERROR]", cause instanceof Error ? cause.message : String(cause));
            throw new Error("Dokumen gagal diambil dari server aplikasi. Periksa koneksi lalu coba lagi.", { cause });
        }
    };
    const previewWindow = !download ? window.open("about:blank", "_blank") : null;
    if (!download) {
        console.log("[WARGA PDF PREVIEW] popup", !!previewWindow);
        if (!previewWindow) {
            console.error("[WARGA PDF PREVIEW ERROR]", "Popup diblokir browser.");
            throw new Error("Popup diblokir browser.");
        }
        try {
            const response = await fetchDocument();
            if (!response.ok) throw new Error(`Gagal mengambil dokumen (${response.status})`);
            const contentType = response.headers.get("content-type") || "";
            const normalizedType = contentType.toLowerCase().split(";", 1)[0].trim();
            const validType = normalizedType === "application/pdf" || normalizedType === "image/jpeg" || normalizedType === "image/png";
            const expectedPdf = documentType === "final-letter";
            if (!validType || (expectedPdf && normalizedType !== "application/pdf")) {
                await response.text().catch(() => "");
                throw new Error(expectedPdf ? `Response bukan PDF. Content-Type: ${contentType}` : `Tipe dokumen tidak didukung. Content-Type: ${contentType}`);
            }
            const blob = await response.blob();
            if (!blob.size) throw new Error("PDF kosong.");
            const objectUrl = URL.createObjectURL(blob);
            previewWindow.location.href = objectUrl;
            window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
            return;
        } catch (error) {
            previewWindow.close();
            console.error("[WARGA PDF PREVIEW ERROR]", error instanceof Error ? error.message : String(error));
            throw error;
        }
    }
    try {
        const response = await fetchDocument();
        if (!response.ok) throw new Error(`Gagal mengambil dokumen (${response.status})`);
        const contentType = response.headers.get("content-type") || "";
        const normalizedType = contentType.toLowerCase().split(";", 1)[0].trim();
        const validType = normalizedType === "application/pdf" || normalizedType === "image/jpeg" || normalizedType === "image/png";
        const expectedPdf = documentType === "final-letter";
        if (!validType || (expectedPdf && normalizedType !== "application/pdf")) {
            await response.text().catch(() => "");
            throw new Error(expectedPdf ? `Response bukan PDF. Content-Type: ${contentType}` : `Tipe dokumen tidak didukung. Content-Type: ${contentType}`);
        }
        const blob = await response.blob();
        if (!blob.size) throw new Error("PDF kosong.");
        const objectUrl = URL.createObjectURL(blob);
        const disposition = response.headers.get("content-disposition") ?? "";
        const fileName = disposition.match(/filename\*?=(?:UTF-8''|\")?([^\";]+)/i)?.[1]?.trim() ?? "surat-TMS.pdf";
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
    } catch (error) {
        console.error("[WARGA PDF PREVIEW ERROR]", error instanceof Error ? error.message : String(error));
        throw error;
    }
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