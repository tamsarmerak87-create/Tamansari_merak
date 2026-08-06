import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/services/supabase";
import { assertWargaProfilePayloadIsSchemaSafe, wargaRegisterSchema, type WargaProfileInsertPayload } from "@/services/warga-auth.service";

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : "Terjadi kesalahan tidak dikenal saat registrasi warga.";
}

async function cleanupAuthUser(userId: string) {
    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) throw new Error("Supabase service role belum dikonfigurasi, cleanup Auth tidak dapat dilakukan.");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(`Cleanup Auth gagal untuk user_id ${userId}: ${error.message}`);
}

export async function POST(request: Request) {
    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) {
        return NextResponse.json({ error: "Supabase service role belum dikonfigurasi. Registrasi server-side tidak dapat dilakukan." }, { status: 500 });
    }

    let createdUserId = "";
    try {
        const body = await request.json();
        const payload = wargaRegisterSchema.parse(body);

        const existingProfile = await supabaseAdmin.from("warga_profiles").select("id,email,nik").or(`email.eq.${payload.email},nik.eq.${payload.nik}`).limit(1).maybeSingle();
        if (existingProfile.error) throw existingProfile.error;
        if (existingProfile.data) return NextResponse.json({ error: "Email atau NIK sudah terdaftar." }, { status: 409 });

        const createUserResponse = await supabaseAdmin.auth.admin.createUser({
            email: payload.email,
            password: payload.password,
            email_confirm: true,
            user_metadata: { nama_lengkap: payload.nama_lengkap, nik: payload.nik, role: "warga" },
        });
        if (createUserResponse.error) throw new Error(createUserResponse.error.message || "Auth error saat membuat akun warga.");
        const user = createUserResponse.data.user;
        if (!user) throw new Error("Auth error: Supabase tidak mengembalikan user setelah pendaftaran.");
        createdUserId = user.id;

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
            foto_url: null,
            role: "warga",
            status_verifikasi: "Belum Terverifikasi",
        }) satisfies WargaProfileInsertPayload;

        console.log("Payload:", profileData);
        const profileResponse = await supabaseAdmin.from("warga_profiles").insert(profileData).select("*").single();
        if (profileResponse.error) {
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

        return NextResponse.json({ user, profile: profileResponse.data, otpSent: false });
    } catch (error) {
        if (createdUserId) {
            try {
                await cleanupAuthUser(createdUserId);
            } catch (cleanupError) {
                console.error("[api/warga/register] Cleanup Auth tambahan gagal", cleanupError);
            }
        }
        console.error("[api/warga/register] Registrasi gagal", error);
        return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
    }
}
