import type { User } from "@supabase/supabase-js";
import { z } from "zod";
import { createSupabaseBrowserClient } from "@/services/supabase";

export type WargaRole = "admin" | "petugas" | "warga";

export type WargaProfile = {
    id?: string;
    user_id: string;
    nama_lengkap: string;
    nik: string;
    nomor_kk: string;
    email: string;
    nomor_whatsapp: string;
    tempat_lahir: string;
    tanggal_lahir: string;
    jenis_kelamin: string;
    alamat: string;
    rt: string;
    rw: string;
    kelurahan: string;
    kecamatan: string;
    foto_url?: string | null;
    role: WargaRole;
    status_verifikasi: "Belum Terverifikasi" | "Akun Terverifikasi";
    otp_code?: string | null;
    otp_expires_at?: string | null;
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

function client() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) throw new Error("Supabase env belum dikonfigurasi.");
    return supabase;
}

function createOtp() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

export function isVerified(profile?: WargaProfile | null) {
    return profile?.status_verifikasi === "Akun Terverifikasi";
}

export async function getCurrentWarga() {
    const supabase = client();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    const user = userData.user;
    if (!user) return { user: null, profile: null };
    const { data: profile, error } = await supabase.from("warga_profiles").select("*").eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    return { user, profile: profile as WargaProfile | null };
}

export async function registerWarga(input: WargaRegisterInput) {
    const payload = wargaRegisterSchema.parse(input);
    const supabase = client();

    const { data: nikExists, error: nikError } = await supabase.from("warga_profiles").select("id").eq("nik", payload.nik).maybeSingle();
    if (nikError) throw nikError;
    if (nikExists) throw new Error("NIK sudah terdaftar.");

    const { data: phoneExists, error: phoneError } = await supabase.from("warga_profiles").select("id").eq("nomor_whatsapp", payload.nomor_whatsapp).maybeSingle();
    if (phoneError) throw phoneError;
    if (phoneExists) throw new Error("Nomor HP sudah terdaftar.");

    const otp = createOtp();
    const { data, error } = await supabase.auth.signUp({
        email: payload.email,
        password: payload.password,
        options: {
            data: { nama_lengkap: payload.nama_lengkap, nik: payload.nik, role: "warga" },
            emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/verify` : undefined,
        },
    });
    if (error) throw error;
    const user = data.user;
    if (!user) throw new Error("Gagal membuat akun warga.");

    const profilePayload: Omit<WargaProfile, "id" | "created_at" | "updated_at"> = {
        user_id: user.id,
        nama_lengkap: payload.nama_lengkap,
        nik: payload.nik,
        nomor_kk: payload.nomor_kk,
        email: payload.email,
        nomor_whatsapp: payload.nomor_whatsapp,
        tempat_lahir: payload.tempat_lahir,
        tanggal_lahir: payload.tanggal_lahir,
        jenis_kelamin: payload.jenis_kelamin,
        alamat: payload.alamat,
        rt: payload.rt,
        rw: payload.rw,
        kelurahan: payload.kelurahan,
        kecamatan: payload.kecamatan,
        role: "warga",
        status_verifikasi: "Belum Terverifikasi",
        otp_code: otp,
        otp_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        foto_url: null,
    };
    const { error: profileError } = await supabase.from("warga_profiles").insert(profilePayload);
    if (profileError) throw profileError;
    await sendOtpNotification(profilePayload);
    return { user, otpSent: true };
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
    const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/dashboard` : undefined;
    const { data, error } = await client().auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) throw error;
    return data;
}

export async function requestPhoneOtp(phone: string) {
    const { data, error } = await client().auth.signInWithOtp({ phone });
    if (error) throw error;
    return data;
}

export async function logoutWarga() {
    const { error } = await client().auth.signOut();
    if (error) throw error;
}

export async function resendWargaOtp() {
    const { user, profile } = await getCurrentWarga();
    if (!user || !profile) throw new Error("Silakan login terlebih dahulu.");
    const otp = createOtp();
    const { error } = await client().from("warga_profiles").update({ otp_code: otp, otp_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() }).eq("user_id", user.id);
    if (error) throw error;
    await sendOtpNotification({ ...profile, otp_code: otp });
}

export async function verifyWargaOtp(code: string) {
    const { user, profile } = await getCurrentWarga();
    if (!user || !profile) throw new Error("Silakan login terlebih dahulu.");
    if (!/^\d{6}$/.test(code)) throw new Error("OTP harus 6 digit.");
    if (profile.status_verifikasi === "Akun Terverifikasi") return profile;
    if (profile.otp_code !== code) throw new Error("Kode OTP tidak sesuai.");
    if (profile.otp_expires_at && new Date(profile.otp_expires_at).getTime() < Date.now()) throw new Error("Kode OTP sudah kedaluwarsa.");
    const { data, error } = await client().from("warga_profiles").update({ status_verifikasi: "Akun Terverifikasi", otp_code: null, otp_expires_at: null }).eq("user_id", user.id).select("*").single();
    if (error) throw error;
    return data as WargaProfile;
}

export async function updateWargaProfile(profile: Partial<WargaProfile>) {
    const { user } = await getCurrentWarga();
    if (!user) throw new Error("Silakan login terlebih dahulu.");
    const { data, error } = await client().from("warga_profiles").update(profile).eq("user_id", user.id).select("*").single();
    if (error) throw error;
    return data as WargaProfile;
}

export async function getWargaSubmissions(profile?: WargaProfile | null) {
    if (!profile?.nik) return [];
    const { data, error } = await client().from("pengajuan_surat").select("*, layanan(*), tracking_pengajuan(*), dokumen_pengajuan(*)").eq("nik", profile.nik).order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
}

export async function sendOtpNotification(profile: Pick<WargaProfile, "email" | "nomor_whatsapp" | "nama_lengkap" | "otp_code">) {
    try {
        await fetch("/api/webhooks/n8n", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ event: "warga/otp", data: { ...profile, message: `Kode OTP Akun Warga Anda: ${profile.otp_code}` } }),
        });
    } catch (error) {
        console.error("OTP notification skipped", error);
    }
}

export type AuthContextValue = {
    user: User | null;
    profile: WargaProfile | null;
    loading: boolean;
    refresh: () => Promise<void>;
};