import { createSupabaseAdminClient } from "@/services/supabase";

export type NotificationStatus = "submitted" | "verified" | "rejected" | "processing" | "completed";

export const NOTIFICATION_MESSAGES: Record<NotificationStatus, string> = {
    submitted: "Pengajuan Anda berhasil dikirim",
    verified: "Pengajuan Anda telah diverifikasi",
    rejected: "Pengajuan Anda ditolak",
    processing: "Pengajuan Anda sedang diproses",
    completed: "Pengajuan Anda telah selesai",
};

type CreateNotificationInput = {
    wargaId?: string | null;
    nik?: string | null;
    pengajuanId: string;
    status: NotificationStatus;
    catatan?: string | null;
};

export async function createWargaNotification(input: CreateNotificationInput) {
    const supabase = createSupabaseAdminClient();
    if (!supabase) return { skipped: true, reason: "Supabase service role belum dikonfigurasi." };

    let wargaId = input.wargaId ?? null;
    if (!wargaId && input.nik) {
        const { data, error } = await supabase.from("warga_profiles").select("id").eq("nik", input.nik).maybeSingle<{ id: string }>();
        if (error) throw error;
        wargaId = data?.id ?? null;
    }
    if (!wargaId) return { skipped: true, reason: "Profil warga tidak ditemukan." };

    const message = NOTIFICATION_MESSAGES[input.status];
    const catatan = input.catatan?.trim();
    const { error } = await supabase.from("warga_notifikasi").insert({
        warga_id: wargaId,
        pengajuan_id: input.pengajuanId,
        title: "Notifikasi Pengajuan",
        message,
        catatan: catatan || null,
        type: "pengajuan",
        read: false,
    });
    if (error) throw error;
    return { ok: true };
}
