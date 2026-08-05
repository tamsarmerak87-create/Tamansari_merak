import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/services/supabase";

export async function GET() {
    try {
        const client = createSupabaseAdminClient();
        if (!client) {
            return NextResponse.json({ ok: false, error: "Supabase service role belum dikonfigurasi." }, { status: 500 });
        }

        const { data, error } = await client
            .from("layanan")
            .select("id, nama, deskripsi, kategori, persyaratan, estimasi, aktif, urutan")
            .eq("aktif", true)
            .order("urutan", { ascending: true, nullsFirst: false })
            .order("nama", { ascending: true });

        if (error) {
            return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true, data: data ?? [] });
    } catch (error) {
        return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Gagal mengambil data layanan." }, { status: 500 });
    }
}