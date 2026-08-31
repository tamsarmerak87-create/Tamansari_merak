import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/services/supabase";
import { isFinalDocument, isVerificationToken } from "@/services/official-document";

export const dynamic = "force-dynamic";
export async function GET(_: Request, { params }: { params: Promise<{ code: string }> }) {
    const { code } = await params;
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{12,64}$/.test(normalized)) return NextResponse.json({ ok: false, status: "INVALID" }, { status: 404 });
    const { data, error } = await createSupabaseAdminClient().from("pengajuan_surat")
        .select("nama_lengkap,nomor_surat,nomor_pengajuan,status,tanggal_surat,issued_at,lurah_name,signer_nip,signer_jabatan,verification_token,verification_code,document_locked,template_snapshot,keperluan,layanan(nama)")
        .eq("verification_code", normalized).maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: "Validasi dokumen gagal." }, { status: 500 });
    if (!data) return NextResponse.json({ ok: false, status: "INVALID" }, { status: 404 });
    if (!isFinalDocument(data) || !isVerificationToken(data.verification_token)) return NextResponse.json({ ok: false, status: "INACTIVE" }, { status: 410 });
    return NextResponse.json({ ok: true, status: "VALID", data: { ...data, nik: undefined, verification_token: undefined } }, { headers: { "cache-control": "no-store" } });
}