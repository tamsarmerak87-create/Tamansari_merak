import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseAnonClient } from "@/services/supabase";
import { getAuthRedirectUrl } from "@/lib/auth-url";
import { assertWargaProfilePayloadIsSchemaSafe, WARGA_PROFILE_CHANGE_DOCUMENT_BUCKET, WARGA_PROFILE_PHOTO_BUCKET, wargaRegisterSchema, type WargaProfileInsertPayload } from "@/services/warga-auth.service";

const MAX_FILE_SIZE = 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : "Terjadi kesalahan tidak dikenal saat registrasi warga.";
}

async function cleanupAuthUser(userId: string) {
    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) throw new Error("Supabase service role belum dikonfigurasi, cleanup Auth tidak dapat dilakukan.");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(`Cleanup Auth gagal untuk user_id ${userId}: ${error.message}`);
}

function extensionFor(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext && ["jpg", "jpeg", "png", "webp"].includes(ext)) return ext;
    return file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
}

function validateImage(file: File | null, label: string) {
    if (!file || file.size === 0) throw new Error(`${label} wajib diupload.`);
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error("Format foto harus JPG, JPEG, PNG, atau WEBP.");
    if (file.size > MAX_FILE_SIZE) throw new Error("Ukuran file masih lebih dari 1 MB. Silakan pilih file lain.");
}

function isBucketNotFound(error: { message?: string; statusCode?: string | number; error?: string }) {
    const text = `${error.message ?? ""} ${error.error ?? ""}`.toLowerCase();
    return error.statusCode === 404 || text.includes("bucket not found") || text.includes("not found");
}

async function ensureRegistrationBucket(supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>, bucket: string, isPublic: boolean) {
    const { data, error } = await supabaseAdmin.storage.getBucket(bucket);
    if (!error && data) return;
    if (!error || !isBucketNotFound(error)) throw error;

    const created = await supabaseAdmin.storage.createBucket(bucket, { public: isPublic });
    if (created.error) {
        throw new Error(`Storage bucket "${bucket}" tidak ditemukan pada Supabase production dan gagal dibuat: ${created.error.message}`);
    }
}

function registrationDocumentRow(userId: string, path: string, jenis: "KTP" | "KK") {
    return {
        user_id: userId,
        profile_id: userId,
        jenis_perubahan: jenis,
        data_lama: "Dokumen registrasi awal",
        data_baru: path,
        alasan: `Upload ${jenis} saat registrasi warga`,
        dokumen_pendukung: path,
        status: "pending",
    };
}

type RegistrationDocumentRow = ReturnType<typeof registrationDocumentRow>;

async function uploadImage(supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>, bucket: string, path: string, file: File) {
    const { data, error } = await supabaseAdmin.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type });
    if (error) {
        if (isBucketNotFound(error)) throw new Error(`Storage bucket "${bucket}" tidak ditemukan pada Supabase production.`);
        throw error;
    }
    return data.path;
}

async function cleanupStorage(supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>, uploads: { bucket: string; path: string }[]) {
    await Promise.all(uploads.map(({ bucket, path }) => supabaseAdmin.storage.from(bucket).remove([path]).catch(() => null)));
}

export async function POST(request: Request) {
    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) {
        return NextResponse.json({ error: "Supabase service role belum dikonfigurasi. Registrasi server-side tidak dapat dilakukan." }, { status: 500 });
    }

    let createdUserId = "";
    try {
        const contentType = request.headers.get("content-type") ?? "";
        const formData = contentType.includes("multipart/form-data") ? await request.formData() : null;
        const body = formData ? JSON.parse(String(formData.get("payload") ?? "{}")) : await request.json();
        const payload = wargaRegisterSchema.parse(body);
        const ktpFile = formData?.get("ktp") instanceof File ? formData.get("ktp") as File : null;
        const kkFile = formData?.get("kk") instanceof File ? formData.get("kk") as File : null;
        const selfieFile = formData?.get("selfie") instanceof File ? formData.get("selfie") as File : null;
        if (formData) {
            validateImage(ktpFile, "KTP");
            validateImage(kkFile, "KK");
            validateImage(selfieFile, "Foto wajah");
        }

        await ensureRegistrationBucket(supabaseAdmin, WARGA_PROFILE_PHOTO_BUCKET, true);
        await ensureRegistrationBucket(supabaseAdmin, WARGA_PROFILE_CHANGE_DOCUMENT_BUCKET, false);

        const existingProfile = await supabaseAdmin.from("warga_profiles").select("id,email,nik").or(`email.eq.${payload.email},nik.eq.${payload.nik}`).limit(1).maybeSingle();
        if (existingProfile.error) throw existingProfile.error;
        if (existingProfile.data) return NextResponse.json({ error: "Email atau NIK sudah terdaftar." }, { status: 409 });

        const createUserResponse = await createSupabaseAnonClient().auth.signUp({
            email: payload.email,
            password: payload.password,
            options: {
                emailRedirectTo: getAuthRedirectUrl(),
                data: { nama_lengkap: payload.nama_lengkap, nik: payload.nik, role: "warga" },
            },
        });
        if (createUserResponse.error) throw new Error(createUserResponse.error.message || "Auth error saat membuat akun warga.");
        const user = createUserResponse.data.user;
        if (!user) throw new Error("Auth error: Supabase tidak mengembalikan user setelah pendaftaran.");
        createdUserId = user.id;
        const uploadedFiles: { bucket: string; path: string }[] = [];
        const fotoUrl = selfieFile ? await uploadImage(supabaseAdmin, WARGA_PROFILE_PHOTO_BUCKET, `${user.id}/profile-${Date.now()}.${extensionFor(selfieFile)}`, selfieFile) : null;
        if (fotoUrl) uploadedFiles.push({ bucket: WARGA_PROFILE_PHOTO_BUCKET, path: fotoUrl });
        const ktpPath = ktpFile ? await uploadImage(supabaseAdmin, WARGA_PROFILE_CHANGE_DOCUMENT_BUCKET, `${user.id}/register-ktp-${Date.now()}.${extensionFor(ktpFile)}`, ktpFile) : null;
        if (ktpPath) uploadedFiles.push({ bucket: WARGA_PROFILE_CHANGE_DOCUMENT_BUCKET, path: ktpPath });
        const kkPath = kkFile ? await uploadImage(supabaseAdmin, WARGA_PROFILE_CHANGE_DOCUMENT_BUCKET, `${user.id}/register-kk-${Date.now()}.${extensionFor(kkFile)}`, kkFile) : null;
        if (kkPath) uploadedFiles.push({ bucket: WARGA_PROFILE_CHANGE_DOCUMENT_BUCKET, path: kkPath });

        const profileData = assertWargaProfilePayloadIsSchemaSafe({
            id: user.id,
            nama_lengkap: payload.nama_lengkap,
            nik: payload.nik,
            nomor_hp: payload.nomor_whatsapp,
            nomor_whatsapp: payload.nomor_whatsapp,
            email: payload.email,
            alamat: payload.alamat,
            rt: payload.rt,
            rw: payload.rw,
            kelurahan: payload.kelurahan,
            kecamatan: payload.kecamatan,
            nomor_kk: payload.nomor_kk,
            tempat_lahir: payload.tempat_lahir,
            tanggal_lahir: payload.tanggal_lahir,
            jenis_kelamin: payload.jenis_kelamin,
            agama: payload.agama,
            status_perkawinan: payload.status_perkawinan,
            status_pekerjaan: payload.status_pekerjaan,
            foto_url: fotoUrl,
            role: "warga",
            status_verifikasi: "Belum Terverifikasi",
        }) satisfies WargaProfileInsertPayload;

        const profileResponse = await supabaseAdmin.from("warga_profiles").insert(profileData).select("*").single();
        if (profileResponse.error) {
            await cleanupStorage(supabaseAdmin, uploadedFiles);
            let cleanupNote = "";
            try {
                await cleanupAuthUser(createdUserId);
                createdUserId = "";
                cleanupNote = " Akun Auth yang sempat dibuat sudah dibersihkan.";
            } catch (cleanupError) {
                cleanupNote = ` Cleanup Auth gagal: ${errorMessage(cleanupError)}`;
            }
            throw new Error(`Profil warga gagal dibuat: ${profileResponse.error.message}.${cleanupNote}`);
        }

        const registrationDocuments: RegistrationDocumentRow[] = [];
        if (ktpPath) registrationDocuments.push(registrationDocumentRow(user.id, ktpPath, "KTP"));
        if (kkPath) registrationDocuments.push(registrationDocumentRow(user.id, kkPath, "KK"));
        if (registrationDocuments.length > 0) {
            const documentResponse = await supabaseAdmin.from("warga_profile_change_requests").insert(registrationDocuments);
            if (documentResponse.error) throw new Error(`Path dokumen registrasi gagal disimpan: ${documentResponse.error.message}`);
        }

        return NextResponse.json({ user, profile: profileResponse.data });
    } catch (error) {
        if (createdUserId) {
            try {
                await cleanupAuthUser(createdUserId);
            } catch (cleanupError) {
                const message = cleanupError instanceof Error ? cleanupError.message : "Cleanup Auth tambahan gagal.";
                console.error(`[api/warga/register] ${message}`);
            }
        }
        console.error(`[api/warga/register] ${errorMessage(error)}`);
        return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
    }
}
