import { NextResponse } from "next/server";
import { searchSubmission } from "@/services/surat-online.service";
import { createSupabaseAdminClient } from "@/services/supabase";

type TrackingHistory = { status?: string; keterangan?: string | null; petugas?: string | null; created_at?: string | null };
type TrackingRow = {
    id?: string;
    nomor_pengajuan?: string;
    nomor_tiket?: string;
    tracking_url?: string;
    jenis_surat?: string;
    created_at?: string;
    updated_at?: string;
    status?: string;
    petugas?: string | null;
    layanan?: { nama?: string; output?: string } | null;
    tracking_pengajuan?: TrackingHistory[];
};

const TRACKING_SELECT = "id, nomor_pengajuan, nomor_tiket, tracking_url, jenis_surat, layanan_id, status, created_at, updated_at, petugas";
type BaseTrackingRow = TrackingRow & { layanan_id?: string | null };

function sanitizeTrackingNumber(value: string) {
    return value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 40);
}

function normalizeStatus(value?: string | null) {
    return String(value ?? "").toLowerCase().trim();
}

function getBucket(status?: string | null) {
    const value = normalizeStatus(status);
    if (value.includes("selesai")) return "done";
    if (value.includes("menunggu") || value.includes("diajukan") || value.includes("diterima")) return "waiting";
    return "processing";
}

function toPublicTracking(row: TrackingRow) {
    const history = Array.isArray(row.tracking_pengajuan) ? row.tracking_pengajuan : [];
    return {
        id: row.id,
        trackingNumber: row.nomor_pengajuan,
        trackingNumberAlias: row.nomor_tiket,
        trackingUrl: row.tracking_url,
        documentType: row.layanan?.nama ?? row.jenis_surat ?? "Dokumen Kelurahan",
        submittedAt: row.created_at,
        updatedAt: row.updated_at,
        currentStatus: row.status,
        statusHistory: history,
        nomor_pengajuan: row.nomor_pengajuan,
        nomor_tiket: row.nomor_tiket,
        tracking_url: row.tracking_url,
        jenis_surat: row.jenis_surat,
        created_at: row.created_at,
        updated_at: row.updated_at,
        status: row.status,
        petugas: row.petugas,
        layanan: row.layanan,
        tracking_pengajuan: history,
    };
}

function toActivity(row: TrackingRow) {
    const history = [...(row.tracking_pengajuan ?? [])].sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
    const latest = history[0];
    return {
        trackingNumber: row.nomor_pengajuan,
        documentType: row.layanan?.nama ?? row.jenis_surat ?? "Dokumen Kelurahan",
        status: latest?.status ?? row.status ?? "Menunggu",
        updatedAt: latest?.created_at ?? row.updated_at ?? row.created_at,
    };
}

async function getMonitorData() {
    const client = createSupabaseAdminClient();
    const [{ count: total, error: totalError }, { data, error }] = await Promise.all([
        client.from("pengajuan_surat").select("id", { count: "exact", head: true }),
        client
            .from("pengajuan_surat")
            .select(TRACKING_SELECT)
            .order("updated_at", { ascending: false })
            .limit(200),
    ]);

    if (totalError) throw totalError;
    if (error) throw error;
    const rows = await hydrateTrackingRows((data ?? []) as BaseTrackingRow[]);
    const buckets = rows.reduce((acc, row) => {
        const bucket = getBucket(row.status);
        if (bucket === "done") acc.done += 1;
        if (bucket === "waiting") acc.waiting += 1;
        if (bucket === "processing") acc.processing += 1;
        return acc;
    }, { processing: 0, waiting: 0, done: 0 });
    const stats = { total: total ?? 0, ...buckets };

    const activity = rows
        .map(toActivity)
        .filter((item) => item.trackingNumber)
        .sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime())
        .slice(0, 8);

    return { stats, activity };
}

async function hydrateTrackingRows(rows: BaseTrackingRow[]) {
    const client = createSupabaseAdminClient();
    const pengajuanIds = rows.map((row) => row.id).filter(Boolean) as string[];
    const layananIds = [...new Set(rows.map((row) => row.layanan_id).filter(Boolean))] as string[];
    const layananById = new Map<string, { nama?: string; output?: string }>();
    const trackingById = new Map<string, TrackingHistory[]>();

    if (layananIds.length > 0) {
        const { data, error } = await client.from("layanan").select("id,nama,output").in("id", layananIds);
        if (error) throw error;
        (data ?? []).forEach((item) => layananById.set(item.id, { nama: item.nama, output: item.output }));
    }

    if (pengajuanIds.length > 0) {
        const { data, error } = await client.from("tracking_pengajuan").select("pengajuan_id,status,keterangan,petugas,created_at").in("pengajuan_id", pengajuanIds).order("created_at", { ascending: true });
        if (error) throw error;
        ((data ?? []) as (TrackingHistory & { pengajuan_id?: string | null })[]).forEach((item) => {
            const key = item.pengajuan_id ?? "";
            trackingById.set(key, [...(trackingById.get(key) ?? []), item]);
        });
    }

    return rows.map((row) => ({
        ...row,
        layanan: row.layanan ?? layananById.get(row.layanan_id ?? "") ?? null,
        tracking_pengajuan: row.tracking_pengajuan ?? trackingById.get(row.id ?? "") ?? [],
    }));
}

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const query = sanitizeTrackingNumber(url.searchParams.get("q")?.trim() ?? "");
        if (!query) return NextResponse.json({ ok: true, data: [], monitor: await getMonitorData() });
        if (!/^TMS-\d{8}-\d{4,}$/.test(query)) return NextResponse.json({ ok: false, error: "Format nomor tracking tidak valid." }, { status: 400 });

        const [rows, monitor] = await Promise.all([searchSubmission(query).then((items) => hydrateTrackingRows(items as BaseTrackingRow[])), getMonitorData()]);
        if (rows.length === 0) return NextResponse.json({ ok: false, error: "Dokumen tidak ditemukan.", monitor }, { status: 404 });

        return NextResponse.json({ ok: true, data: rows.map(toPublicTracking), monitor });
    } catch (error) {
        console.error("===== TRACKING ERROR =====");
        console.dir(error, { depth: null });
        return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Gagal mengambil status dokumen." }, { status: 500 });
    }
}