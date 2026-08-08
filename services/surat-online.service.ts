import { z } from "zod";
import { createSupabaseAdminClient, createSupabaseBrowserClient } from "@/services/supabase";
import { forwardToN8n, getAppBaseUrl } from "@/services/integrations";
import { createVerificationRows } from "@/services/verification-workflow";

export const STATUS_STEPS = ["Permohonan diterima", "Verifikasi", "Diproses", "Ditandatangani", "Selesai"] as const;
export const SUBMISSION_STATUS = ["Menunggu Verifikasi", "Verifikasi", "Diproses", "Ditandatangani", "Selesai", "Ditolak"] as const;

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];

export const submissionSchema = z.object({
    layanan_id: z.string().min(1, "Jenis layanan wajib dipilih"),
    nik: z.string().regex(/^\d{16}$/, "NIK harus 16 angka"),
    nama_lengkap: z.string().min(3, "Nama lengkap wajib diisi"),
    nomor_kk: z.string().regex(/^\d{16}$/, "Nomor KK harus 16 angka"),
    tempat_lahir: z.string().min(2, "Tempat lahir wajib diisi"),
    tanggal_lahir: z.string().min(1, "Tanggal lahir wajib diisi"),
    jenis_kelamin: z.string().min(1, "Jenis kelamin wajib dipilih"),
    agama: z.string().min(1, "Agama wajib dipilih"),
    status_perkawinan: z.string().min(1, "Status perkawinan wajib dipilih"),
    pekerjaan: z.string().min(2, "Pekerjaan wajib diisi"),
    alamat: z.string().min(8, "Alamat wajib diisi"),
    rt_rw: z.string().min(3, "RT/RW wajib diisi"),
    kelurahan: z.string().min(2, "Kelurahan wajib diisi"),
    kecamatan: z.string().min(2, "Kecamatan wajib diisi"),
    nomor_hp: z.string().regex(/^(\+62|62|0)8[1-9][0-9]{6,11}$/, "Nomor HP tidak valid"),
    email: z.string().email("Email tidak valid"),
    jenis_surat: z.string().min(1, "Jenis surat wajib diisi"),
    keperluan: z.string().min(5, "Keperluan wajib diisi"),
    catatan: z.string().optional().default(""),
});

export type SubmissionInput = z.infer<typeof submissionSchema>;

export function validateUploadFile(file: File) {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) throw new Error("File harus PDF, JPG, atau PNG.");
    if (file.size > MAX_FILE_SIZE) throw new Error("Ukuran file maksimal 5 MB.");
}

export function getProgressFromStatus(status?: string) {
    if (status === "Selesai") return 5;
    if (status === "Ditandatangani") return 4;
    if (status === "Diproses") return 3;
    if (status === "Verifikasi") return 2;
    return 1;
}

export function createNomorPengajuan(sequence: number, date = new Date()) {
    const stamp = date.toISOString().slice(0, 10).replace(/-/g, "");
    return `TMS-${stamp}-${String(sequence).padStart(4, "0")}`;
}

export function createNomorTiket(sequence: number, date = new Date()) {
    const stamp = date.toISOString().slice(0, 10).replace(/-/g, "");
    return `TIK-${stamp}-${String(sequence).padStart(6, "0")}`;
}

export function createTrackingUrl(nomorPengajuan: string) {
    return `${getAppBaseUrl()}/surat-online/tracking?nomor=${encodeURIComponent(nomorPengajuan)}`;
}

async function sendPengajuanEmail(payload: {
    to: string;
    nama: string;
    nomor_pengajuan: string;
    nomor_tiket: string;
    tanggal: string;
    jenis_pelayanan: string;
    tracking_url: string;
}) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || !payload.to) return { skipped: true, reason: "RESEND_API_KEY/email belum tersedia" };

    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
        },
        body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL ?? "Kelurahan Tamansari <noreply@tamansari-merak.vercel.app>",
            to: payload.to,
            subject: "Pengajuan Surat Berhasil",
            html: `
                <div style="font-family:Arial,sans-serif;line-height:1.7;color:#0f172a">
                    <h2>Pengajuan Surat Berhasil</h2>
                    <p>Yth. ${payload.nama}, permohonan surat online Anda berhasil diterima.</p>
                    <ul>
                        <li><b>Nomor Pengajuan:</b> ${payload.nomor_pengajuan}</li>
                        <li><b>Nomor Tiket:</b> ${payload.nomor_tiket}</li>
                        <li><b>Tanggal:</b> ${payload.tanggal}</li>
                        <li><b>Jenis Pelayanan:</b> ${payload.jenis_pelayanan}</li>
                    </ul>
                    <p>Cek status melalui tautan berikut:</p>
                    <p><a href="${payload.tracking_url}">${payload.tracking_url}</a></p>
                    <p>Kelurahan Tamansari<br/>Kecamatan Pulomerak<br/>Kota Cilegon</p>
                </div>
            `,
        }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) return { ok: false, status: response.status, data };
    return { ok: true, status: response.status, data };
}

export async function getLayananList() {
    const client = createSupabaseBrowserClient();
    if (!client) return [];
    const { data, error } = await client
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
        .order("nama", { ascending: true });
    if (error) {
        console.error("SUPABASE LAYANAN LIST ERROR");
        console.dir(error, { depth: null });
        throw error;
    }
    return data ?? [];
}

export async function createSubmission(formData: FormData) {
    if (typeof window !== "undefined") {
        try {
            const response = await fetch("/api/surat-online/pengajuan", { method: "POST", body: formData });
            const result = await response.json().catch(() => null);
            const message = typeof result?.error === "string" ? result.error : result?.error?.message;
            if (!response.ok || !result?.ok) throw new Error(message ?? "Gagal mengirim pengajuan.");
            return result.data;
        } catch (error) {
            console.error("SURAT ONLINE CLIENT SUBMIT ERROR");
            console.dir(error, { depth: null });
            throw error;
        } finally {
            // Semua cleanup UI ditangani komponen pemanggil.
        }
    }

    const client = createSupabaseAdminClient();
    if (!client) throw new Error("Supabase service role belum dikonfigurasi.");

    let payload: SubmissionInput;
    let ktp: File | null = null;
    let kk: File | null = null;
    let pendukung: File | null = null;

    try {
        payload = submissionSchema.parse({
            layanan_id: formData.get("layanan_id"),
            nik: formData.get("nik"),
            nama_lengkap: formData.get("nama_lengkap"),
            nomor_kk: formData.get("nomor_kk"),
            tempat_lahir: formData.get("tempat_lahir"),
            tanggal_lahir: formData.get("tanggal_lahir"),
            jenis_kelamin: formData.get("jenis_kelamin"),
            agama: formData.get("agama"),
            status_perkawinan: formData.get("status_perkawinan"),
            pekerjaan: formData.get("pekerjaan"),
            alamat: formData.get("alamat"),
            rt_rw: formData.get("rt_rw"),
            kelurahan: formData.get("kelurahan"),
            kecamatan: formData.get("kecamatan"),
            nomor_hp: formData.get("nomor_hp"),
            email: formData.get("email"),
            jenis_surat: formData.get("jenis_surat"),
            keperluan: formData.get("keperluan"),
            catatan: formData.get("catatan") ?? "",
        });
        ktp = formData.get("ktp") as File | null;
        kk = formData.get("kk") as File | null;
        pendukung = formData.get("pendukung") as File | null;
        if (!ktp || !kk) throw new Error("Upload KTP dan KK wajib diisi.");
        [ktp, kk, pendukung].filter(Boolean).forEach((file) => validateUploadFile(file as File));
    } catch (error) {
        console.error("SURAT ONLINE VALIDATION ERROR");
        console.dir(error, { depth: null });
        throw error;
    } finally {
        // Tidak ada resource yang perlu dibersihkan pada tahap validasi.
    }

    const uploadedPaths: string[] = [];
    let pengajuanId: string | null = null;

    const cleanup = async () => {
        try {
            if (pengajuanId) {
                await client.from("tracking_pengajuan").delete().eq("pengajuan_id", pengajuanId);
                await client.from("dokumen_pengajuan").delete().eq("pengajuan_id", pengajuanId);
                await client.from("pengajuan_surat").delete().eq("id", pengajuanId);
            }
            if (uploadedPaths.length > 0) await client.storage.from("surat").remove(uploadedPaths);
        } catch (cleanupError) {
            console.error("[surat-online:rollback]", cleanupError);
        }
    };

    const uploadOne = async (folder: "ktp" | "kk" | "pendukung", file: File | null) => {
        if (!file) return null;
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `${folder}/${nomor_pengajuan}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await client.storage.from("surat").upload(path, file, { upsert: false, contentType: file.type });
        if (error) {
            console.error("SUPABASE STORAGE UPLOAD ERROR");
            console.dir(error, { depth: null });
            throw error;
        }
        uploadedPaths.push(path);
        return client.storage.from("surat").getPublicUrl(path).data.publicUrl;
    };

    let nomor_pengajuan = "";
    let nomor_tiket = "";
    let tracking_url = "";

    try {
        const { data: layanan, error: layananError } = await client
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
            .eq("id", payload.layanan_id)
            .maybeSingle();
        if (layananError) {
            console.error("SUPABASE SELECT LAYANAN ERROR");
            console.dir(layananError, { depth: null });
            throw layananError;
        }
        if (!layanan) throw new Error("Jenis layanan tidak ditemukan atau tidak aktif.");

        const layananRecord = layanan as Record<string, unknown>;
        const jenisSuratFromDatabase = String(layananRecord.nama ?? payload.jenis_surat);

        const today = new Date().toISOString().slice(0, 10);
        const { count, error: countError } = await client.from("pengajuan_surat").select("id", { count: "exact", head: true }).gte("created_at", `${today}T00:00:00`).lte("created_at", `${today}T23:59:59`);
        if (countError) {
            console.error("SUPABASE COUNT PENGAJUAN_SURAT ERROR");
            console.dir(countError, { depth: null });
            throw countError;
        }
        const sequence = (count ?? 0) + 1;
        nomor_pengajuan = createNomorPengajuan(sequence);
        nomor_tiket = createNomorTiket(sequence);
        tracking_url = createTrackingUrl(nomor_pengajuan);

        const ktp_url = await uploadOne("ktp", ktp);
        const kk_url = await uploadOne("kk", kk);
        const pendukung_url = await uploadOne("pendukung", pendukung);

        const [rt = "", rw = ""] = payload.rt_rw.split("/").map((part) => part.trim());
        const pengajuanPayload = {
            layanan_id: payload.layanan_id,
            nik: payload.nik,
            nama_lengkap: payload.nama_lengkap,
            nomor_kk: payload.nomor_kk,
            tempat_lahir: payload.tempat_lahir,
            tanggal_lahir: payload.tanggal_lahir,
            jenis_kelamin: payload.jenis_kelamin,
            agama: payload.agama,
            status_perkawinan: payload.status_perkawinan,
            pekerjaan: payload.pekerjaan,
            alamat: payload.alamat,
            rt,
            rw,
            kelurahan: payload.kelurahan,
            kecamatan: payload.kecamatan,
            no_hp: payload.nomor_hp,
            email: payload.email,
            jenis_surat: jenisSuratFromDatabase,
            keperluan: payload.keperluan,
            catatan: payload.catatan,
            nomor_pengajuan,
            status: "Menunggu Verifikasi",
            file_ktp: ktp_url,
            file_kk: kk_url,
            file_pendukung: pendukung_url,
        };

        const { data: pengajuan, error } = await client.from("pengajuan_surat").insert(pengajuanPayload).select("*, layanan(*)").single();
        if (error) {
            console.error("INSERT ERROR:", error);
            console.error("SUPABASE INSERT PENGAJUAN_SURAT ERROR");
            console.dir(error, { depth: null });
            throw error;
        }
        pengajuanId = pengajuan.id;

        const { error: verificationError } = await client.from("verifikasi_pengajuan").insert(createVerificationRows(pengajuan.id));
        if (verificationError) {
            console.error("SUPABASE INSERT VERIFIKASI_PENGAJUAN ERROR");
            console.dir(verificationError, { depth: null });
            throw verificationError;
        }

        const { error: dokumenError } = await client.from("dokumen_pengajuan").insert([
            {
                pengajuan_id: pengajuan.id,
                nama_file: "KTP",
                url_file: ktp_url,
                jenis: "KTP",
            },
            {
                pengajuan_id: pengajuan.id,
                nama_file: "KK",
                url_file: kk_url,
                jenis: "KK",
            },
            ...(pendukung_url
                ? [{
                    pengajuan_id: pengajuan.id,
                    nama_file: "Dokumen Pendukung",
                    url_file: pendukung_url,
                    jenis: "Pendukung",
                }]
                : []),
        ]);
        if (dokumenError) {
            console.error("SUPABASE INSERT DOKUMEN_PENGAJUAN ERROR");
            console.dir(dokumenError, { depth: null });
            throw dokumenError;
        }

        const { error: trackingError } = await client.from("tracking_pengajuan").insert({
            pengajuan_id: pengajuan.id,
            status: "Menunggu Verifikasi",
            keterangan: "Permohonan diterima dan menunggu verifikasi.",
            petugas: null,
        });
        if (trackingError) {
            console.error("SUPABASE INSERT TRACKING_PENGAJUAN ERROR");
            console.error(trackingError);
            console.dir(trackingError, { depth: null });
            throw trackingError;
        }

        try {
            const n8nResult = await forwardToN8n("surat-online/created", { nomor_pengajuan, nomor_tiket, tracking_url, email: payload.email, nomor_hp: payload.nomor_hp, status: "Menunggu Verifikasi" });
            if ("ok" in n8nResult && n8nResult.ok === false) {
                console.error("N8N FORWARD ERROR");
                console.dir(n8nResult, { depth: null });
            }
        } catch (n8nError) {
            console.error("N8N FORWARD ERROR");
            console.dir(n8nError, { depth: null });
        }

        try {
            const emailResult = await sendPengajuanEmail({
                to: payload.email,
                nama: payload.nama_lengkap,
                nomor_pengajuan,
                nomor_tiket,
                tanggal: pengajuan.created_at ?? new Date().toISOString(),
                jenis_pelayanan: jenisSuratFromDatabase,
                tracking_url,
            });
            if ("ok" in emailResult && emailResult.ok === false) {
                console.error("RESEND EMAIL ERROR");
                console.dir(emailResult, { depth: null });
            }
        } catch (emailError) {
            console.error("RESEND EMAIL ERROR");
            console.dir(emailError, { depth: null });
        }

        return { ...pengajuan, jenis_surat: jenisSuratFromDatabase, nomor_tiket, tracking_url };
    } catch (error) {
        console.error("===== CREATE SUBMISSION FULL ERROR =====");
        console.dir(error, { depth: null });
        await cleanup();
        throw error;
    } finally {
        // State loading/hasil ditangani oleh client pemanggil; cleanup error ditangani di catch.
    }
}

export async function searchSubmission(query: string) {
    if (typeof window !== "undefined") {
        try {
            const response = await fetch(`/api/surat-online/tracking?q=${encodeURIComponent(query)}`);
            const result = await response.json().catch(() => null);
            const message = typeof result?.error === "string" ? result.error : result?.error?.message;
            if (!response.ok || !result?.ok) throw new Error(message ?? "Gagal mengambil status pengajuan.");
            return result.data ?? [];
        } catch (error) {
            console.error("SURAT ONLINE CLIENT SEARCH ERROR");
            console.dir(error, { depth: null });
            throw error;
        } finally {
            // State loading ditangani komponen pemanggil.
        }
    }

    const client = createSupabaseAdminClient();
    if (!client) throw new Error("Supabase service role belum dikonfigurasi.");
    const q = query.trim();
    if (!q) return [];
    const { data, error } = await client.from("pengajuan_surat").select("*, layanan(*), tracking_pengajuan(*), dokumen_pengajuan(*)").or(`nomor_pengajuan.eq.${q},nik.eq.${q}`).order("created_at", { referencedTable: "tracking_pengajuan", ascending: true });
    if (error) {
        console.error("SUPABASE SEARCH SUBMISSION ERROR");
        console.dir(error, { depth: null });
        throw error;
    }
    return data ?? [];
}

export async function updateSubmissionStatus(id: string, status: string, catatan?: string, petugas?: string, file_surat_url?: string, petugasId?: string) {
    const client = createSupabaseAdminClient();
    if (!client) throw new Error("Supabase service role belum dikonfigurasi.");
    if (!petugasId) throw new Error("ID petugas dari session admin wajib tersedia untuk mengubah status pengajuan.");

    const now = new Date().toISOString();
    const normalizedStatus = status === "Sedang Diproses" ? "Diproses" : status;
    const updatePayload: Record<string, string | null | undefined> = {
        status: normalizedStatus,
        updated_at: now,
        catatan_admin: catatan ?? null,
        file_surat_url,
    };

    if (normalizedStatus === "Terverifikasi") {
        updatePayload.verified_at = now;
        updatePayload.verified_by = petugasId;
        updatePayload.alasan_penolakan = null;
    } else if (normalizedStatus === "Diproses") {
        updatePayload.diproses_at = now;
        updatePayload.diproses_by = petugasId;
        updatePayload.alasan_penolakan = null;
    } else if (normalizedStatus === "Selesai") {
        updatePayload.selesai_at = now;
        updatePayload.selesai_by = petugasId;
        updatePayload.alasan_penolakan = null;
    } else if (normalizedStatus === "Ditolak") {
        if (!catatan?.trim()) throw new Error("Alasan penolakan wajib diisi.");
        updatePayload.alasan_penolakan = catatan.trim();
    } else {
        throw new Error("Status pengajuan tidak valid untuk workflow admin.");
    }

    const { data, error } = await client.from("pengajuan_surat").update(updatePayload).eq("id", id).select("*").single();
    if (error) {
        console.error("SUPABASE UPDATE PENGAJUAN_SURAT ERROR");
        console.dir(error, { depth: null });
        throw error;
    }

    const { error: trackingError } = await client.from("tracking_pengajuan").insert({
        pengajuan_id: id,
        status: normalizedStatus,
        keterangan: catatan ?? null,
        petugas,
        created_at: now,
    });
    if (trackingError) {
        console.error("SUPABASE INSERT STATUS TRACKING_PENGAJUAN ERROR");
        console.error(trackingError);
        console.dir(trackingError, { depth: null });
        throw trackingError;
    }

    try {
        const tracking_url = createTrackingUrl(data.nomor_pengajuan);
        const n8nResult = await forwardToN8n("surat-online/status", {
            nomor_pengajuan: data.nomor_pengajuan,
            status,
            catatan,
            petugas,
            tracking_url,
            whatsapp_message: `Assalamu'alaikum.\n\nPermohonan Surat Anda\n\nNomor:\n${data.nomor_pengajuan}\n\nStatus:\n${status}\n\nSilakan cek:\n${tracking_url}\n\nKelurahan Tamansari`,
        });
        if ("ok" in n8nResult && n8nResult.ok === false) {
            console.error("N8N STATUS FORWARD ERROR");
            console.dir(n8nResult, { depth: null });
        }
    } catch (n8nError) {
        console.error("N8N STATUS FORWARD ERROR");
        console.dir(n8nError, { depth: null });
    }
    return data;
}