import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession, requireAdmin } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";

type ActorType = "warga" | "petugas" | "admin" | "lurah" | "unknown";
type TargetType = "pengajuan" | "warga" | "verifikasi" | "tracking";
type JsonRecord = Record<string, unknown>;

type Activity = {
    id: string;
    created_at: string | null;
    actor_id: string | null;
    actor_name: string | null;
    actor_type: ActorType;
    actor_role: string | null;
    activity: string;
    target_id: string | null;
    target_name: string | null;
    target_type: TargetType;
    status: string | null;
    status_before: string | null;
    status_after: string | null;
    description: string | null;
    source: string;
};

type Filters = {
    from: string | null;
    to: string | null;
    actor: string | null;
    activity: string | null;
    status: string | null;
    search: string | null;
};

function jsonError(message: string, status = 400) {
    return NextResponse.json({ ok: false, error: message }, { status });
}

function asRecord(value: unknown): JsonRecord {
    return value && typeof value === "object" ? (value as JsonRecord) : {};
}

function text(value: unknown) {
    return value === null || value === undefined ? null : String(value);
}

function timestamp(row: JsonRecord) {
    return text(row.created_at ?? row.updated_at ?? row.acted_at ?? row.approved_at);
}

function roleToActorType(role: unknown): ActorType {
    const value = text(role)?.toLowerCase() ?? "";
    if (!value) return "unknown";
    if (value === "admin" || value.includes("admin")) return "admin";
    if (value === "lurah" || value.includes("lurah")) return "lurah";
    if (value.includes("warga")) return "warga";
    if (value.includes("petugas") || value.includes("staff") || value.includes("seksi") || value.includes("seklur")) return "petugas";
    return "unknown";
}

function staffName(staff: JsonRecord | null | undefined) {
    return text(staff?.nama_lengkap ?? staff?.username);
}

function staffRole(staff: JsonRecord | null | undefined) {
    return text(staff?.role ?? staff?.jabatan);
}

function targetName(target: JsonRecord | null | undefined) {
    const layanan = asRecord(target?.layanan);
    return [text(target?.nama_lengkap), text(layanan.nama)].filter(Boolean).join(" - ") || null;
}

function addActivity(activities: Activity[], activity: Omit<Activity, "id"> & { id?: string | null }) {
    activities.push({
        id: activity.id ?? `${activity.source}-${activities.length + 1}`,
        created_at: activity.created_at ?? null,
        actor_id: activity.actor_id ?? null,
        actor_name: activity.actor_name ?? null,
        actor_type: activity.actor_type ?? "unknown",
        actor_role: activity.actor_role ?? null,
        activity: activity.activity,
        target_id: activity.target_id ?? null,
        target_name: activity.target_name ?? null,
        target_type: activity.target_type,
        status: activity.status ?? null,
        status_before: activity.status_before ?? null,
        status_after: activity.status_after ?? null,
        description: activity.description ?? null,
        source: activity.source,
    });
}

function applyDateRange(query: any, filters: Filters) {
    let next = query;
    if (filters.from) next = next.gte("created_at", filters.from);
    if (filters.to) {
        const toDate = /^\d{4}-\d{2}-\d{2}$/.test(filters.to) ? `${filters.to}T23:59:59.999Z` : filters.to;
        next = next.lte("created_at", toDate);
    }
    return next;
}

function rows(value: unknown): JsonRecord[] {
    return Array.isArray(value) ? value.map(asRecord) : [];
}

function matchesFilter(activity: Activity, filters: Filters) {
    const actorNeedle = filters.actor?.toLowerCase();
    if (actorNeedle) {
        const actorValues = [activity.actor_id, activity.actor_name, activity.actor_type, activity.actor_role].filter(Boolean).join(" ").toLowerCase();
        if (!actorValues.includes(actorNeedle)) return false;
    }
    if (filters.activity && !activity.activity.toLowerCase().includes(filters.activity.toLowerCase())) return false;
    if (filters.status) {
        const statusValues = [activity.status, activity.status_before, activity.status_after].filter(Boolean).join(" ").toLowerCase();
        if (!statusValues.includes(filters.status.toLowerCase())) return false;
    }
    if (filters.search) {
        const searchValues = [activity.actor_name, activity.activity, activity.target_name, activity.target_id].filter(Boolean).join(" ").toLowerCase();
        if (!searchValues.includes(filters.search.toLowerCase())) return false;
    }
    return true;
}

function statusBucket(value: string | null) {
    const status = value?.toLowerCase() ?? "";
    if (["selesai", "disetujui", "terverifikasi", "approved"].some((item) => status.includes(item))) return "selesai";
    if (["ditolak", "rejected"].some((item) => status.includes(item))) return "ditolak";
    if (["menunggu", "diproses", "pending", "belum"].some((item) => status.includes(item))) return "menunggu";
    return null;
}

function buildStats(activities: Activity[]) {
    return {
        totalWarga: new Set(activities.filter((item) => item.target_type === "warga" && item.target_id).map((item) => item.target_id)).size,
        totalPetugas: new Set(activities.filter((item) => item.actor_type === "petugas" && item.actor_id).map((item) => item.actor_id)).size,
        totalActivities: activities.length,
        totalPengajuan: new Set(activities.filter((item) => item.target_type === "pengajuan" && item.target_id).map((item) => item.target_id)).size,
        selesai: activities.filter((item) => statusBucket(item.status_after ?? item.status) === "selesai").length,
        ditolak: activities.filter((item) => statusBucket(item.status_after ?? item.status) === "ditolak").length,
        menunggu: activities.filter((item) => statusBucket(item.status_after ?? item.status) === "menunggu").length,
        aktivitasWarga: activities.filter((item) => item.actor_type === "warga" || item.target_type === "warga").length,
        aktivitasPetugas: activities.filter((item) => item.actor_type === "petugas").length,
        verifikasiWarga: activities.filter((item) => item.source === "warga_profiles.verification_history" || (item.target_type === "warga" && item.activity.toLowerCase().includes("verifikasi"))).length,
    };
}

export async function GET(request: NextRequest) {
    const session = await getAdminSession(request, { cookie: "admin" });
    if (session.error || !session.profile) return jsonError("Session admin tidak valid.", 401);
    if (requireAdmin(session.profile)) return jsonError("Akses khusus admin.", 403);

    const supabase = createSupabaseAdminClient();
    if (!supabase) return jsonError("Supabase service role belum dikonfigurasi.", 500);

    const params = request.nextUrl.searchParams;
    const filters: Filters = {
        from: params.get("from"),
        to: params.get("to"),
        actor: params.get("actor"),
        activity: params.get("activity"),
        status: params.get("status"),
        search: params.get("search"),
    };

    const [audit, tracking, verifikasi, pengajuan, warga, petugas] = await Promise.all([
        applyDateRange(supabase.from("audit_pengajuan").select("*").order("created_at", { ascending: false }), filters),
        applyDateRange(supabase.from("tracking_pengajuan").select("*").order("created_at", { ascending: false }), filters),
        applyDateRange(supabase.from("verifikasi_pengajuan").select("*").order("created_at", { ascending: false }), filters),
        applyDateRange(supabase.from("pengajuan_surat").select("id,nama_lengkap,layanan_id,status,created_at,updated_at,verified_by,layanan:layanan_id(nama)").order("created_at", { ascending: false }), filters),
        applyDateRange(supabase.from("warga_profiles").select("id,nama_lengkap,role,status_verifikasi,created_at,updated_at,verification_history").order("created_at", { ascending: false }), filters),
        supabase.from("petugas").select("id,username,nama_lengkap,jabatan,role,is_active,created_at"),
    ]);

    const firstError = audit.error ?? tracking.error ?? verifikasi.error ?? pengajuan.error ?? warga.error ?? petugas.error;
    if (firstError) return jsonError(firstError.message, 500);

    const petugasRows = rows(petugas.data);
    const pengajuanRows = rows(pengajuan.data);
    const petugasById = new Map(petugasRows.map((item) => [String(item.id), item]));
    const pengajuanById = new Map(pengajuanRows.map((item) => [String(item.id), item]));
    const activities: Activity[] = [];

    for (const item of rows(audit.data)) {
        const staffId = text(item.user_id ?? item.petugas_id);
        const staff = staffId ? petugasById.get(staffId) : null;
        const actorRole = text(item.role ?? item.jabatan) ?? staffRole(staff);
        const target = item.pengajuan_id ? pengajuanById.get(String(item.pengajuan_id)) : null;
        addActivity(activities, {
            id: `audit-${text(item.id) ?? activities.length}`,
            created_at: timestamp(item),
            actor_id: staffId,
            actor_name: text(item.nama_petugas) ?? staffName(staff),
            actor_type: roleToActorType(actorRole),
            actor_role: actorRole,
            activity: text(item.aksi ?? item.action ?? item.event) ?? "Audit pengajuan",
            target_id: text(item.pengajuan_id ?? item.id),
            target_name: targetName(target),
            target_type: "pengajuan",
            status: text(item.status ?? item.status_sesudah),
            status_before: text(item.status_sebelum),
            status_after: text(item.status_sesudah),
            description: text(item.catatan ?? item.description ?? item.keterangan),
            source: "audit_pengajuan",
        });
    }

    for (const item of rows(tracking.data)) {
        const staffId = text(item.petugas_id ?? item.user_id);
        const staff = staffId ? petugasById.get(staffId) : null;
        const actorRole = text(item.role ?? item.role_petugas) ?? staffRole(staff);
        const target = item.pengajuan_id ? pengajuanById.get(String(item.pengajuan_id)) : null;
        addActivity(activities, {
            id: `tracking-${text(item.id) ?? activities.length}`,
            created_at: timestamp(item),
            actor_id: staffId,
            actor_name: text(item.nama_petugas) ?? staffName(staff),
            actor_type: roleToActorType(actorRole),
            actor_role: actorRole,
            activity: text(item.status) ?? "Tracking pengajuan",
            target_id: text(item.pengajuan_id ?? item.id),
            target_name: targetName(target),
            target_type: "tracking",
            status: text(item.status),
            status_before: text(item.status_sebelum),
            status_after: text(item.status_sesudah),
            description: text(item.keterangan ?? item.catatan),
            source: "tracking_pengajuan",
        });
    }

    for (const item of rows(verifikasi.data)) {
        const staffId = text(item.petugas_id ?? item.user_id);
        const staff = staffId ? petugasById.get(staffId) : null;
        const actorRole = text(item.role_petugas ?? item.jabatan) ?? staffRole(staff);
        const target = item.pengajuan_id ? pengajuanById.get(String(item.pengajuan_id)) : null;
        addActivity(activities, {
            id: `verifikasi-${text(item.id) ?? activities.length}`,
            created_at: timestamp(item),
            actor_id: staffId,
            actor_name: text(item.nama_petugas) ?? staffName(staff),
            actor_type: roleToActorType(actorRole),
            actor_role: actorRole,
            activity: text(item.nama_tahap) ?? "Verifikasi pengajuan",
            target_id: text(item.pengajuan_id ?? item.id),
            target_name: targetName(target),
            target_type: "verifikasi",
            status: text(item.status),
            status_before: text(item.status_sebelum),
            status_after: text(item.status_sesudah),
            description: text(item.catatan ?? item.hasil_verifikasi),
            source: "verifikasi_pengajuan",
        });
    }

    for (const item of pengajuanRows) {
        const staffId = text(item.verified_by);
        const staff = staffId ? petugasById.get(staffId) : null;
        const actorRole = staffRole(staff);
        const layananName = text(asRecord(item.layanan).nama);
        addActivity(activities, {
            id: `pengajuan-${text(item.id) ?? activities.length}`,
            created_at: timestamp(item),
            actor_id: staffId,
            actor_name: staffName(staff),
            actor_type: roleToActorType(actorRole),
            actor_role: actorRole,
            activity: layananName ? `Pengajuan ${layananName}` : "Pengajuan surat",
            target_id: text(item.id),
            target_name: targetName(item),
            target_type: "pengajuan",
            status: text(item.status),
            status_before: null,
            status_after: null,
            description: text(item.nama_lengkap) ? `Pengajuan surat oleh ${text(item.nama_lengkap)}` : null,
            source: "pengajuan_surat",
        });
    }

    for (const item of rows(warga.data)) {
        addActivity(activities, {
            id: `warga-${text(item.id) ?? activities.length}`,
            created_at: timestamp(item),
            actor_id: text(item.id),
            actor_name: text(item.nama_lengkap),
            actor_type: roleToActorType(item.role),
            actor_role: text(item.role),
            activity: "Profil warga",
            target_id: text(item.id),
            target_name: text(item.nama_lengkap),
            target_type: "warga",
            status: text(item.status_verifikasi),
            status_before: null,
            status_after: null,
            description: text(item.nama_lengkap) ? `Profil warga ${text(item.nama_lengkap)}` : null,
            source: "warga_profiles",
        });

        const history = Array.isArray(item.verification_history) ? item.verification_history : [];
        history.forEach((entry, index) => {
            const historyItem = asRecord(entry);
            const staffId = text(historyItem.petugas_id);
            const actorRole = text(historyItem.role);
            addActivity(activities, {
                id: `warga-history-${text(item.id) ?? "unknown"}-${index}`,
                created_at: text(historyItem.created_at ?? historyItem.timestamp ?? historyItem.waktu) ?? timestamp(item),
                actor_id: staffId,
                actor_name: text(historyItem.nama_petugas) ?? staffId,
                actor_type: roleToActorType(actorRole),
                actor_role: actorRole,
                activity: text(historyItem.action) ?? "Riwayat verifikasi warga",
                target_id: text(item.id),
                target_name: text(item.nama_lengkap),
                target_type: "warga",
                status: text(historyItem.status_sesudah ?? historyItem.status),
                status_before: text(historyItem.status_sebelum),
                status_after: text(historyItem.status_sesudah),
                description: text(historyItem.catatan),
                source: "warga_profiles.verification_history",
            });
        });
    }

    const filteredActivities = activities.filter((item) => matchesFilter(item, filters));
    filteredActivities.sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));

    return NextResponse.json({ ok: true, data: { activities: filteredActivities, stats: buildStats(filteredActivities), filters } });
}