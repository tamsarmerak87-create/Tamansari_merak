import type { User } from "@supabase/supabase-js";
import { z } from "zod";
import { createSupabaseBrowserClient } from "@/services/supabase";

export type WargaRole = "admin" | "petugas" | "warga";
export type WargaVerificationStatus = "Belum Terverifikasi" | "Akun Terverifikasi" | "Terverifikasi" | "Ditolak";

export type WargaProfile = {
    id: string;
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

    const { data: profile, error } = await supabase.from("warga_profiles").select("id,nama_lengkap,email,nik,status_verifikasi,alasan_penolakan").eq("id", user.id).maybeSingle();
    if (error) throw error;
    return { user, profile: profile as WargaProfile | null };
}

export async function getCurrentWarga() {
    const supabase = client();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    const user = userData.user;
    if (!user) return { user: null, profile: null };
    const { data: profile, error } = await supabase.from("warga_profiles").select("*").eq("id", user.id).maybeSingle();
    if (error) throw error;
    return { user, profile: profile as WargaProfile | null };
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
    const { user } = await getCurrentWarga();
    if (!user) throw new Error("Silakan login terlebih dahulu.");
    const blocked = new Set(["id", "role", "status_verifikasi", "user_id", "nik", "nomor_kk", "email", "alasan_penolakan", "created_at", "updated_at"]);
    const profileData = Object.fromEntries(Object.entries(sanitizeWargaProfileUpdatePayload(profile)).filter(([key]) => !blocked.has(key)));
    const { data, error } = await client().from("warga_profiles").update(profileData).eq("id", user.id).select("*").single();
    if (error) throw error;
    return data as WargaProfile;
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