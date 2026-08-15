import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/services/supabase";

export async function GET() {
    const supabase = createSupabaseServerClient();

    const { data, error } = await supabase
        .from("layanan")
        .select(`
            id,
            nama,
            deskripsi,
            aktif,
            persyaratan,
            alur,
            dasar_hukum,
            output,
            kanal,
            created_at
        `)
        .eq("aktif", true)
        .order("nama", { ascending: true });

    return NextResponse.json({
        total: data?.length ?? 0,
        error: error ? "Gagal memuat layanan." : null,
        data,
    });
}