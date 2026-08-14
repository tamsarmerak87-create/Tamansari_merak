import type { User } from "@supabase/supabase-js";
import { z } from "zod";
import { createSupabaseBrowserClient } from "@/services/supabase";

export const WARGA_PROFILE_PHOTO_BUCKET = "avatars";
export const WARGA_PROFILE_CHANGE_DOCUMENT_BUCKET = "profile-change-documents";

export type WargaRole = "admin" | "petugas" | "warga";
export type WargaVerificationStatus = "Belum Terverifikasi" | "Akun Terverifikasi" | "Terverifikasi" | "Ditolak";

export type WargaProfile = {
    id: string;
    user_id?: string | null;
    nama_lengkap: string;
    nik: string;
    nomor_kk: string;
    email: string;
    nomor_hp?: string | null;
    nomor_whatsapp: string;
    tempat_lahir: string;
    tanggal_lahir: string;
    jenis_kelamin?: string | null;
    alamat: string;
    rt: string;
    rw: string;
    kelurahan: string;
    kecamatan: string;
    foto_url?: string | null;
    role: WargaRole;
    status_verifikasi: WargaVerificationStatus;
    alasan_penolakan?: string | null;
    created_at?: string;
    updated_at?: string;
};

export type WargaProfileChangeStatus = "pending" | "approved" | "rejected";
export type WargaProfileChangeRequest = {
    id: string;
    change_request_id?: string | null;
    user_id: string;
    profile_id: string;
    jenis_perubahan: string;
    data_lama?: string | null;
    data_baru: string;
    alasan: string;
    dokumen_pendukung?: string | null;
    status: WargaProfileChangeStatus;
    alasan_petugas?: string | null;
    created_at: string;
    verified_at?: string | null;
    verified_by?: string | null;
};

export const wargaRegisterSchema = z.object({
    nama_lengkap: z.string().min(3, "Nama lengkap wajib diisi"),
    nik: z.string().regex(/^\d{16}$/, "NIK harus 16 angka"),
    nomor_kk: z.string().regex(/^\d{16}$/, "Nomor KK harus 16 angka"),
    email: z.string().email("Email tidak valid"),
    nomor_whatsapp: z.string().regex(/^(\+62|62|0)8[1-9][0-9]{6,11}$/, "Nomor WhatsApp tidak valid"),
    tempat_lahir: z.string().min(2, "Tempat lahir wajib diisi"),
    tanggal_lahir: z.string().min(1, "Tanggal lahir wajib diisi"),
    jenis_kelamin: z.string().min(1, "Jenis kelamin wajib dipilih"),
    alamat: z.string().min(8, "Alamat wajib diisi"),
    rt: z.string().min(1, "RT wajib diisi"),
    rw: z.string().min(1, "RW wajib diisi"),
    kelurahan: z.string().min(2, "Kelurahan wajib diisi"),
    kecamatan: z.string().min(2, "Kecamatan wajib diisi"),
    password: z.string().min(8, "Password minimal 8 karakter"),
    confirmPassword: z.string().min(8, "Konfirmasi password wajib diisi"),
    terms: z.boolean().refine(Boolean, "Syarat dan ketentuan wajib disetujui"),
}).refine((data) => data.password === data.confirmPassword, { path: ["confirmPassword"], message: "Konfirmasi password tidak sama" });

export const wargaLoginSchema = z.object({
    identifier: z.string().min(3, "Email atau NIK wajib diisi"),
    password: z.string().min(8, "Password minimal 8 karakter"),
    remember: z.boolean().optional(),
});

export type WargaRegisterInput = z.infer<typeof wargaRegisterSchema>;
export type WargaLoginInput = z.infer<typeof wargaLoginSchema>;

export const wargaProfileInsertColumns = [
    "id",
    "nama_lengkap",
    "nik",
    "nomor_hp",
    "nomor_whatsapp",
    "email",
    "alamat",
    "rt",
    "rw",
    "kelurahan",
    "kecamatan",
    "nomor_kk",
    "tempat_lahir",
    "tanggal_lahir",
    "jenis_kelamin",
    "foto_url",
    "role",
    "status_verifikasi",
] as const;

export type WargaProfileInsertColumn = (typeof wargaProfileInsertColumns)[number];
export type WargaProfileInsertPayload = Pick<WargaProfile, WargaProfileInsertColumn>;

export const wargaProfileInsertSchema = z.object({
    id: z.string().uuid("User ID auth tidak valid"),
    nama_lengkap: z.string().min(3),
    nik: z.string().regex(/^\d{16}$/),
    nomor_hp: z.string().min(8),
    nomor_whatsapp: z.string().min(8),
    email: z.string().email(),
    alamat: z.string().min(8),
    rt: z.string().min(1),
    rw: z.string().min(1),
    kelurahan: z.string().min(2),
    kecamatan: z.string().min(2),
    nomor_kk: z.string().regex(/^\d{16}$/),
    tempat_lahir: z.string().min(2),
    tanggal_lahir: z.string().min(1),
    jenis_kelamin: z.string().min(1),
    foto_url: z.string().nullable().optional(),
    role: z.literal("warga"),
    status_verifikasi: z.enum(["Belum Terverifikasi", "Akun Terverifikasi", "Terverifikasi"]),
}).strict();

export function assertWargaProfilePayloadIsSchemaSafe(payload: Record<string, unknown>) {
    const allowed = new Set<string>(wargaProfileInsertColumns);
    const invalidColumns = Object.keys(payload).filter((key) => !allowed.has(key));
    if (invalidColumns.length > 0) {
        throw new Error(`Payload warga_profiles tidak sinkron dengan schema database. Kolom tidak tersedia: ${invalidColumns.join(", ")}.`);
    }
    return wargaProfileInsertSchema.parse(payload);
}

export function sanitizeWargaProfileUpdatePayload(profile: Partial<WargaProfile>) {
    const allowed = new Set<string>(wargaProfileInsertColumns.filter((column) => column !== "id"));
    return Object.fromEntries(Object.entries(profile).filter(([key]) => allowed.has(key)));
}

function client() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) throw new Error("Supabase env belum dikonfigurasi. Periksa NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY.");
    return supabase;
}

const WARGA_PROFILE_COLUMNS = "id,nama_lengkap,nik,nomor_kk,email,nomor_hp,nomor_whatsapp,tempat_lahir,tanggal_lahir,jenis_kelamin,alamat,rt,rw,kelurahan,kecamatan,foto_url,role,status_verifikasi,alasan_penolakan,created_at,updated_at";

type ProfileQueryDebug = {
    authUserId: string;
    profileId?: string | null;
    table: "warga_profiles";
    filterColumn: "id" | "user_id" | "email";
    filterValue?: string | null;
    rowCount: number;
    operation: "select" | "update";
};

function debugProfileQuery(info: ProfileQueryDebug) {
    if (process.env.NODE_ENV === "production") return;
    console.debug("[warga_profiles:query]", info);
}

function isRlsDenied(error: SupabaseLikeError) {
    const message = error.message?.toLowerCase() ?? "";
    return error.code === "42501" || message.includes("row-level security") || message.includes("permission denied");
}

async function getProfileForUser(user: User): Promise<WargaProfile | null> {
    const supabase = client();
    const byId = await supabase.from("warga_profiles").select(WARGA_PROFILE_COLUMNS).eq("id", user.id).maybeSingle<WargaProfile>();
    if (byId.error) throw byId.error;
    debugProfileQuery({ authUserId: user.id, profileId: byId.data?.id, table: "warga_profiles", filterColumn: "id", filterValue: user.id, rowCount: byId.data ? 1 : 0, operation: "select" });
    if (byId.data) return byId.data;

    const byUserId = await supabase.from("warga_profiles").select(WARGA_PROFILE_COLUMNS).eq("user_id", user.id).maybeSingle<WargaProfile>();
    if (byUserId.error && byUserId.error.code !== "42703") throw byUserId.error;
    debugProfileQuery({ authUserId: user.id, profileId: byUserId.data?.id, table: "warga_profiles", filterColumn: "user_id", filterValue: user.id, rowCount: byUserId.data ? 1 : 0, operation: "select" });
    if (byUserId.data) return byUserId.data;

    const byEmail = await supabase.from("warga_profiles").select(WARGA_PROFILE_COLUMNS).eq("email", user.email ?? "").maybeSingle<WargaProfile>();
    if (byEmail.error) throw byEmail.error;
    debugProfileQuery({ authUserId: user.id, profileId: byEmail.data?.id, table: "warga_profiles", filterColumn: "email", filterValue: user.email, rowCount: byEmail.data ? 1 : 0, operation: "select" });
    return byEmail.data;
}

export function isVerified(profile?: WargaProfile | null) {
    return profile?.status_verifikasi === "Akun Terverifikasi" || profile?.status_verifikasi === "Terverifikasi";
}

export function getVerificationRedirectPath(profile?: WargaProfile | null) {
    if (!profile) return "/verify";
    if (profile.status_verifikasi === "Ditolak") return "/verification-rejected";
    if (isVerified(profile)) return "/dashboard";
    return "/verify";
}

export async function getCurrentWargaVerificationStatus() {
    const supabase = client();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    const user = userData.user;
    if (!user) return { user: null, profile: null };

    const profile = await getProfileForUser(user);
    return { user, profile };
}

export async function getCurrentWarga() {
    const supabase = client();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    const user = userData.user;
    if (!user) return { user: null, profile: null };
    const profile = await getProfileForUser(user);
    return { user, profile };
}

export async function registerWarga(input: WargaRegisterInput) {
    try {
        const payload = wargaRegisterSchema.parse(input);
        const supabase = client();

        const response = await fetch("/api/warga/register", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
        });
        const result = await response.json().catch(() => null) as { user?: User; profile?: WargaProfile; error?: string } | null;
        if (!response.ok || !result?.user || !result.profile) {
            throw new Error(result?.error || "Registrasi gagal. Akun Auth tidak dibuat atau sudah dibersihkan karena profil gagal dibuat.");
        }

        const signInResponse = await supabase.auth.signInWithPassword({ email: payload.email, password: payload.password });
        if (signInResponse.error) {
            throw new Error(`Akun dan profil berhasil dibuat, tetapi login otomatis gagal: ${signInResponse.error.message}. Silakan login manual.`);
        }
        return { user: signInResponse.data.user ?? result.user, profile: result.profile };
    } catch (error) {
        throw error;
    }
}

async function findEmailByNik(nik: string) {
    const supabase = client();
    const { data, error } = await supabase.from("warga_profiles").select("email").eq("nik", nik).maybeSingle();
    if (error) throw error;
    return data?.email as string | undefined;
}

export async function loginWarga(input: WargaLoginInput) {
    const payload = wargaLoginSchema.parse(input);
    const email = payload.identifier.includes("@") ? payload.identifier : await findEmailByNik(payload.identifier);
    if (!email) throw new Error("Email atau NIK tidak ditemukan.");
    const { data, error } = await client().auth.signInWithPassword({ email, password: payload.password });
    if (error) throw error;
    return data;
}

export async function signInWithGoogle() {
    const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/verify` : undefined;
    const { data, error } = await client().auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) throw error;
    return data;
}

export async function logoutWarga() {
    const { error } = await client().auth.signOut();
    if (error) throw error;
}

export async function updateWargaProfile(profile: Partial<WargaProfile>) {
    const { user, profile: currentProfile } = await getCurrentWarga();
    if (!user) throw new Error("Silakan login terlebih dahulu.");
    if (!currentProfile?.id) throw new Error("Profil warga tidak ditemukan untuk akun login ini. Periksa apakah akun Auth sudah memiliki row di public.warga_profiles.");
    const blocked = new Set(["id", "role", "status_verifikasi", "user_id", "nik", "nomor_kk", "alasan_penolakan", "created_at"]);
    const profileData = Object.fromEntries(Object.entries(sanitizeWargaProfileUpdatePayload(profile)).filter(([key]) => !blocked.has(key)));
    if (Object.keys(profileData).length > 0) profileData.updated_at = new Date().toISOString();
    const { data, error } = await client().from("warga_profiles").update(profileData).eq("id", currentProfile.id).select(WARGA_PROFILE_COLUMNS).maybeSingle();
    debugProfileQuery({ authUserId: user.id, profileId: currentProfile.id, table: "warga_profiles", filterColumn: "id", filterValue: currentProfile.id, rowCount: data ? 1 : 0, operation: "update" });
    if (error) {
        const supabaseError = error as SupabaseLikeError;
        if (isRlsDenied(supabaseError)) throw new Error(`Profil ditemukan, tetapi UPDATE ditolak RLS public.warga_profiles: ${supabaseError.message}`);
        throw error;
    }
    if (!data) throw new Error("Profil ditemukan saat SELECT, tetapi UPDATE tidak mengembalikan row. Periksa policy UPDATE public.warga_profiles untuk akun login ini.");
    return data as WargaProfile;
}

const WARGA_PROFILE_CHANGE_COLUMNS = "id,change_request_id,user_id,profile_id,jenis_perubahan,data_lama,data_baru,alasan,dokumen_pendukung,status,alasan_petugas,created_at,verified_at,verified_by";

export async function getWargaProfileChangeRequests() {
    const { user, profile } = await getCurrentWarga();
    if (!user || !profile?.id) return [];
    const { data, error } = await client()
        .from("warga_profile_change_requests")
        .select(WARGA_PROFILE_CHANGE_COLUMNS)
        .eq("user_id", user.id)
        .eq("profile_id", profile.id)
        .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as WargaProfileChangeRequest[];
}

export async function uploadWargaProfileChangeDocument(file: File) {
    if (!file || file.size === 0) return null;
    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowed.includes(file.type)) throw new Error("Format dokumen harus JPG, PNG, atau PDF.");
    if (file.size > 1024 * 1024) throw new Error("Ukuran dokumen maksimal 1 MB.");
    const supabase = client();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error("Silakan login terlebih dahulu.");
    const ext = file.name.split(".").pop()?.toLowerCase() || (file.type === "application/pdf" ? "pdf" : "jpg");
    const path = `${user.id}/change-${Date.now()}.${ext}`;
    const upload = await supabase.storage.from(WARGA_PROFILE_CHANGE_DOCUMENT_BUCKET).upload(path, file, { upsert: false, contentType: file.type });
    if (upload.error) throw upload.error;
    return upload.data.path;
}

export async function submitWargaProfileChangeRequest(input: { jenis_perubahan: string; data_lama?: string | null; data_baru: string; alasan: string; dokumen_pendukung?: string | null }) {
    const { user, profile } = await getCurrentWarga();
    if (!user) throw new Error("Silakan login terlebih dahulu.");
    if (!profile?.id) throw new Error("Profil warga tidak ditemukan.");
    const payload = {
        user_id: user.id,
        profile_id: profile.id,
        jenis_perubahan: input.jenis_perubahan,
        data_lama: input.data_lama ?? null,
        data_baru: input.data_baru.trim(),
        alasan: input.alasan.trim(),
        dokumen_pendukung: input.dokumen_pendukung ?? null,
        status: "pending" as const,
    };
    if (!payload.jenis_perubahan) throw new Error("Pilih data yang ingin diubah.");
    if (!payload.data_baru) throw new Error("Isi data yang benar.");
    if (!payload.alasan) throw new Error("Isi alasan perubahan.");
    const { data, error } = await client().from("warga_profile_change_requests").insert(payload).select(WARGA_PROFILE_CHANGE_COLUMNS).single();
    if (error) throw error;
    return data as WargaProfileChangeRequest;
}

type SupabaseLikeError = Error & { code?: string; statusCode?: string | number; status?: string | number };

function logProfilePhotoError(error: unknown, context: string) {
    if (process.env.NODE_ENV === "production") return;
    const err = error as Partial<SupabaseLikeError> | null;
    console.error(`[warga_profile_photo:${context}]`, {
        message: err?.message ?? "Operasi foto profil gagal.",
        code: err?.code,
        statusCode: err?.statusCode ?? err?.status,
    });
}

function getStorageObjectPath(value?: string | null) {
    if (!value || value.startsWith("blob:")) return "";
    if (!/^https?:\/\//i.test(value)) return value.replace(/^\/+/, "");
    try {
        const url = new URL(value);
        const marker = `/storage/v1/object/public/${WARGA_PROFILE_PHOTO_BUCKET}/`;
        const index = url.pathname.indexOf(marker);
        return index >= 0 ? decodeURIComponent(url.pathname.slice(index + marker.length)) : "";
    } catch {
        return "";
    }
}

export function getWargaProfilePhotoUrl(value?: string | null) {
    const path = getStorageObjectPath(value);
    if (!path) return "";
    if (/^https?:\/\//i.test(value ?? "")) return value ?? "";
    return client().storage.from(WARGA_PROFILE_PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function uploadWargaProfilePhoto(file: File) {
    if (!file || file.size === 0) throw new Error("Pilih foto profil terlebih dahulu.");
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) throw new Error("Format foto harus JPG, JPEG, PNG, atau WebP.");
    if (file.size > 5 * 1024 * 1024) throw new Error("Ukuran foto maksimal 5 MB.");

    const supabase = client();
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error("Silakan login terlebih dahulu.");

    const ext = file.name.split(".").pop()?.toLowerCase() || (file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg");
    const path = `${user.id}/profile-${Date.now()}.${ext}`;

    if (process.env.NODE_ENV !== "production") {
        console.debug("[warga_profile_photo:upload_attempt]", {
            authenticatedUserId: user.id,
            hasSession: Boolean(sessionData.session),
            bucket: WARGA_PROFILE_PHOTO_BUCKET,
            objectPath: path,
        });
    }

    const upload = await supabase.storage.from(WARGA_PROFILE_PHOTO_BUCKET).upload(path, file, { upsert: false, contentType: file.type });
    if (upload.error) {
        logProfilePhotoError(upload.error, "upload");
        if (process.env.NODE_ENV !== "production") {
            console.debug("[warga_profile_photo:upload_error_context]", {
                authenticatedUserId: user.id,
                bucket: WARGA_PROFILE_PHOTO_BUCKET,
                objectPath: path,
            });
        }
        throw upload.error;
    }

    const publicUrl = supabase.storage.from(WARGA_PROFILE_PHOTO_BUCKET).getPublicUrl(upload.data.path).data.publicUrl;
    return { bucket: WARGA_PROFILE_PHOTO_BUCKET, path: upload.data.path, url: publicUrl };
}

export async function updateWargaPassword(password: string) {
    if (password.length < 8) throw new Error("Password minimal 8 karakter.");
    const { error } = await client().auth.updateUser({ password });
    if (error) throw error;
}

export async function getWargaSubmissions(profile?: WargaProfile | null) {
    if (!profile?.nik) return [];
    const { data, error } = await client().from("pengajuan_surat").select("id,nomor_pengajuan,nik,nama_lengkap,layanan_id,keperluan,status,created_at,updated_at,file_ktp,file_kk,file_pendukung").eq("nik", profile.nik).order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
}

export type AuthContextValue = {
    user: User | null;
    profile: WargaProfile | null;
    loading: boolean;
    refresh: () => Promise<void>;
};