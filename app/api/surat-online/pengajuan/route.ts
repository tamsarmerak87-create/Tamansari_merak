import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/services/supabase";

function createNomorPengajuan(sequence: number, date = new Date()) {
  const stamp = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `TMS-${stamp}-${String(sequence).padStart(6, "0")}`;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const client = createSupabaseAdminClient();
    if (!client) {
      return NextResponse.json({ ok: false, error: "Supabase service role belum dikonfigurasi." }, { status: 500 });
    }

    const serviceId = String(formData.get("serviceId") ?? "").trim();
    const nik = String(formData.get("nik") ?? "").trim();
    const kk = String(formData.get("kk") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const birthplace = String(formData.get("birthplace") ?? "").trim();
    const birthdate = String(formData.get("birthdate") ?? "").trim();
    const gender = String(formData.get("gender") ?? "").trim();
    const address = String(formData.get("address") ?? "").trim();
    const rt = String(formData.get("rt") ?? "").trim();
    const rw = String(formData.get("rw") ?? "").trim();
    const village = String(formData.get("village") ?? "").trim();
    const district = String(formData.get("district") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const purpose = String(formData.get("purpose") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim();

    if (!serviceId || !nik || !kk || !name || !birthplace || !birthdate || !gender || !address || !rt || !rw || !village || !district || !phone || !email || !purpose) {
      return NextResponse.json({ ok: false, error: "Data pengajuan belum lengkap." }, { status: 400 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const { count } = await client
      .from("pengajuan_surat")
      .select("id", { count: "exact", head: true })
      .gte("created_at", `${today}T00:00:00`)
      .lte("created_at", `${today}T23:59:59`);
    const nomor_pengajuan = createNomorPengajuan((count ?? 0) + 1);

    const { data, error } = await client
      .from("pengajuan_surat")
      .insert({
        layanan_id: serviceId,
        nik,
        nomor_kk: kk,
        nama_lengkap: name,
        tempat_lahir: birthplace,
        tanggal_lahir: birthdate,
        jenis_kelamin: gender,
        alamat: address,
        rt_rw: `${rt}/${rw}`,
        kelurahan: village,
        kecamatan: district,
        nomor_hp: phone,
        email,
        jenis_surat: String(formData.get("serviceId") ?? ""),
        keperluan: purpose,
        catatan: note || null,
        nomor_pengajuan,
        status: "Menunggu Verifikasi",
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const { error: trackingError } = await client.from("tracking_pengajuan").insert({
      id_pengajuan: data.id,
      status: "Permohonan Diterima",
      progress: 1,
      catatan: "Permohonan diterima dan menunggu verifikasi.",
    });

    if (trackingError) {
      return NextResponse.json({ ok: false, error: trackingError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: { nomor_pengajuan: data.nomor_pengajuan, id: data.id } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Gagal mengirim pengajuan." }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "Gunakan POST untuk mengirim pengajuan." });
}
