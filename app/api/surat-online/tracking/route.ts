import { NextResponse } from "next/server";
import { searchSubmission } from "@/services/surat-online.service";

type TrackingRow = {
  id?: string;
  nomor_pengajuan?: string;
  nomor_tiket?: string;
  tracking_url?: string;
  nama_lengkap?: string;
  jenis_surat?: string;
  created_at?: string;
  updated_at?: string;
  status?: string;
  petugas?: string | null;
  layanan?: { nama?: string; output?: string } | null;
  tracking_pengajuan?: unknown[];
};

function sanitizeTrackingNumber(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 40);
}

function toPublicTracking(row: TrackingRow) {
  return {
    id: row.id,
    trackingNumber: row.nomor_pengajuan,
    trackingNumberAlias: row.nomor_tiket,
    trackingUrl: row.tracking_url,
    documentType: row.layanan?.nama ?? row.jenis_surat ?? "Dokumen Kelurahan",
    applicantName: row.nama_lengkap,
    submittedAt: row.created_at,
    updatedAt: row.updated_at,
    currentStatus: row.status,
    statusHistory: row.tracking_pengajuan ?? [],
    nomor_pengajuan: row.nomor_pengajuan,
    nomor_tiket: row.nomor_tiket,
    tracking_url: row.tracking_url,
    jenis_surat: row.jenis_surat,
    nama_lengkap: row.nama_lengkap,
    created_at: row.created_at,
    updated_at: row.updated_at,
    status: row.status,
    petugas: row.petugas,
    layanan: row.layanan,
    tracking_pengajuan: row.tracking_pengajuan ?? [],
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = sanitizeTrackingNumber(url.searchParams.get("q")?.trim() ?? "");
    if (!query) {
      return NextResponse.json({ ok: false, error: "Query pencarian wajib diisi." }, { status: 400 });
    }
    if (!/^TMS-\d{8}-\d{4,}$/.test(query)) {
      return NextResponse.json({ ok: false, error: "Format nomor tracking tidak valid." }, { status: 400 });
    }

    const rows = (await searchSubmission(query)) as TrackingRow[];
    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: "Dokumen tidak ditemukan." }, { status: 404 });
    }
    const data = rows.map(toPublicTracking);

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("===== FULL ERROR =====");
    console.dir(error, { depth: null });

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal mengambil status pengajuan.",
      },
      { status: 500 },
    );
  }
}
