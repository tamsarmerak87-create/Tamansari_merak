"use client";

import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
    ArrowRight,
    Bell,
    Check,
    CheckCircle2,
    Clock,
    CloudUpload,
    Download,
    Eye,
    FileCheck2,
    FileText,
    HelpCircle,
    Mail,
    MessageCircle,
    Phone,
    Printer,
    QrCode,
    RefreshCw,
    Scale,
    Search,
    Send,
    ShieldCheck,
    XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/card";
import { site } from "@/constants/site";
import { createSubmission, removeSubmissionAttachments, searchSubmission, submissionSchema, uploadSubmissionAttachment } from "@/services/surat-online.service";
import type { PublicService } from "@/types";
import { cn } from "@/utils/cn";
import QRCode from "qrcode";
import { createSupabaseBrowserClient } from "@/services/supabase";
import { useWargaAuth } from "@/components/auth/warga-auth-provider";
import { BuktiPengajuanPrint } from "@/components/pengajuan/BuktiPengajuanPrint";

type ServiceCatalogItem = PublicService & { estimate: string };

function createEmptyForm(serviceId = "") {
    return {
        serviceId,
        nik: "",
        kk: "",
        name: "",
        birthplace: "",
        birthdate: "",
        gender: "",
        religion: "",
        maritalStatus: "",
        job: "",
        address: "",
        rt: "",
        rw: "",
        village: "Tamansari",
        district: "Pulomerak",
        phone: "",
        email: "",
        purpose: "",
        note: "",
        consent: false,
        responsibility: false,
        physicalProofGenerated: false,
        physicalProofViewed: false,
        physicalProofApproved: false,
        physicalProofGeneratedAt: "",
    };
}

const stats = [
    { label: "33 Pelayanan", icon: FileCheck2 },
    { label: "Pengajuan Online", icon: Send },
    { label: "Tracking Status", icon: Search },
    { label: "Respon Cepat", icon: Bell },
];

const steps = ["Data Pemohon", "Data Pengajuan", "Upload Dokumen", "Review", "Persetujuan", "Bukti Fisik", "Konfirmasi", "Kirim"];
const timeline = ["Permohonan Diterima", "Verifikasi", "Diproses", "Ditandatangani", "Selesai"];
const statusList = ["Menunggu", "Diproses", "Verifikasi", "Ditolak", "Selesai"];
const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];

type FormState = ReturnType<typeof createEmptyForm>;
type FileKey = "ktp" | "kk" | "support";
type UploadState = Record<FileKey, File | null>;
type SubmissionResult = Record<string, unknown> & {
    nomor_pengajuan: string;
    nomor_tiket?: string;
    tracking_url?: string;
    created_at?: string;
    nama_lengkap?: string;
    nik?: string;
    jenis_surat?: string;
    keperluan?: string;
    status?: string;
    petugas?: string | null;
    layanan?: { nama?: string; output?: string } | null;
    tracking_pengajuan?: TrackingItem[];
};
type TrackingItem = { status?: string; progress?: number; petugas?: string | null; created_at?: string; keterangan?: string | null };
type DocumentItem = { jenis_dokumen?: string; file_url?: string; jenis?: string; url_file?: string; nama_file?: string; created_at?: string };
type StatusItem = SubmissionResult & { tracking_pengajuan?: TrackingItem[]; dokumen_pengajuan?: DocumentItem[] };

const inputClass = "min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-gov-950 outline-none transition focus:ring-4 focus:ring-accent-200";

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
    return (
        <label className="block">
            <span className="mb-2 block text-sm font-black text-gov-950">{label}</span>
            {children}
            {error ? <span className="mt-2 flex items-center gap-1 text-xs font-bold text-red-600"><XCircle size={14} />{error}</span> : null}
        </label>
    );
}

export default function SuratOnlineClient({ services, initialServiceId = "", formOnly = false }: { services: PublicService[]; initialServiceId?: string; formOnly?: boolean }) {
    const serviceCatalog = useMemo<ServiceCatalogItem[]>(() => services.filter((item) => item.category === "administrasi").slice(0, 33).map((item, index) => ({
        ...item,
        estimate: item.output?.replace(/^Estimasi\s+/i, "") || (index % 3 === 0 ? "1 hari kerja" : index % 3 === 1 ? "2 hari kerja" : "3 hari kerja"),
    })), [services]);
    const firstServiceId = initialServiceId || serviceCatalog[0]?.id || "";
    const [selectedId, setSelectedId] = useState(firstServiceId);
    const [form, setForm] = useState<FormState>(() => createEmptyForm(firstServiceId));
    const [files, setFiles] = useState<UploadState>({ ktp: null, kk: null, support: null });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitted, setSubmitted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [ticket, setTicket] = useState("");
    const [successData, setSuccessData] = useState<SubmissionResult | null>(null);
    const [statusQuery, setStatusQuery] = useState("");
    const [statusChecked, setStatusChecked] = useState(false);
    const [statusLoading, setStatusLoading] = useState(false);
    const [statusError, setStatusError] = useState("");
    const [statusResults, setStatusResults] = useState<StatusItem[]>([]);
    const [lastStatusQuery, setLastStatusQuery] = useState("");
    const [proofPreviewOpen, setProofPreviewOpen] = useState(false);
    const { user, profile } = useWargaAuth();

    const selectedService = useMemo(() => serviceCatalog.find((item) => item.id === selectedId) ?? serviceCatalog[0], [serviceCatalog, selectedId]);

    function update(name: keyof FormState, value: string | boolean) {
        setForm((prev) => ({ ...prev, [name]: value }));
        setErrors((prev) => ({ ...prev, [name]: "" }));
    }

    function pickService(id: string) {
        setSelectedId(id);
        update("serviceId", id);
        document.getElementById("form-pengajuan")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    useEffect(() => {
        const fromQuery = new URLSearchParams(window.location.search).get("layanan");
        const nextId = initialServiceId || fromQuery || "";
        if (!nextId || !serviceCatalog.some((item) => item.id === nextId)) return;
        setSelectedId(nextId);
        setForm((prev) => ({ ...prev, serviceId: nextId }));
    }, [initialServiceId, serviceCatalog]);

    function setFile(key: FileKey, event: ChangeEvent<HTMLInputElement>) {
        setFiles((prev) => ({ ...prev, [key]: event.target.files?.[0] ?? null }));
        setErrors((prev) => ({ ...prev, [key]: "" }));
    }

    function validate() {
        const next: Record<string, string> = {};
        const rtRw = `${form.rt}/${form.rw}`;
        const payload = {
            layanan_id: form.serviceId,
            nik: form.nik,
            nama_lengkap: form.name,
            nomor_kk: form.kk,
            tempat_lahir: form.birthplace,
            tanggal_lahir: form.birthdate,
            jenis_kelamin: form.gender,
            agama: form.religion,
            status_perkawinan: form.maritalStatus,
            pekerjaan: form.job,
            alamat: form.address,
            rt_rw: rtRw,
            kelurahan: form.village,
            kecamatan: form.district,
            nomor_hp: form.phone,
            email: form.email,
            jenis_surat: selectedService?.title ?? "",
            keperluan: form.purpose,
            catatan: form.note,
        };
        try {
            submissionSchema.parse(payload);
        } catch (error) {
            if (error instanceof Error && "issues" in error) (error as { issues: { path: (string | number)[]; message: string }[] }).issues.forEach((issue) => {
                const key = String(issue.path[0] ?? "");
                const map: Record<string, string> = { layanan_id: "serviceId", nama_lengkap: "name", nomor_kk: "kk", tempat_lahir: "birthplace", tanggal_lahir: "birthdate", jenis_kelamin: "gender", agama: "religion", status_perkawinan: "maritalStatus", pekerjaan: "job", alamat: "address", rt_rw: "rt", kelurahan: "village", kecamatan: "district", nomor_hp: "phone", keperluan: "purpose" };
                next[map[key] ?? key] = issue.message;
            });
        }
        const required: (keyof FormState)[] = ["serviceId", "nik", "kk", "name", "birthplace", "birthdate", "gender", "religion", "maritalStatus", "job", "address", "rt", "rw", "village", "district", "phone", "email", "purpose"];
        required.forEach((key) => { if (!String(form[key]).trim()) next[key] = "Wajib diisi"; });
        (["ktp", "kk"] as FileKey[]).forEach((key) => {
            const file = files[key];
            if (!file) next[key] = "Dokumen wajib diunggah";
            else if (!allowedTypes.includes(file.type)) next[key] = "Format harus PDF, JPG, atau PNG";
            else if (file.size > 5 * 1024 * 1024) next[key] = "Ukuran maksimal 5MB";
        });
        const support = files.support;
        if (support && !allowedTypes.includes(support.type)) next.support = "Format harus PDF, JPG, atau PNG";
        else if (support && support.size > 5 * 1024 * 1024) next.support = "Ukuran maksimal 5MB";
        if (!form.consent) next.consent = "Pernyataan persetujuan wajib dicentang";
        if (!form.responsibility) next.responsibility = "Pernyataan tanggung jawab wajib dicentang";
        if (!form.physicalProofGenerated) next.physicalProofGenerated = "Bukti fisik permohonan wajib dibuat";
        if (!form.physicalProofViewed || !form.physicalProofApproved) next.physicalProofApproved = "Bukti fisik wajib dilihat dan disetujui";
        setErrors(next);
        return Object.keys(next).length === 0;
    }

    async function submit(e: FormEvent) {
        e.preventDefault();
        try {
            if (user && profile?.status_verifikasi !== "Akun Terverifikasi" && profile?.status_verifikasi !== "Terverifikasi") {
                alert("Akun Anda belum diverifikasi. Silakan verifikasi akun sebelum mengajukan layanan.");
                window.location.href = "/verify";
                return;
            }
            if (!validate()) return;
            const confirmationMessage = `Apakah Anda yakin ingin mengirim permohonan?\n\nNama: ${form.name || "-"}\nLayanan: ${selectedService?.title ?? "-"}\nDokumen: ${[files.ktp, files.kk, files.support].filter(Boolean).length} berkas\nPernyataan: Disetujui\nTanggung jawab: Disetujui`;
            if (!window.confirm(confirmationMessage)) return;
            setIsSubmitting(true);
            const payload = {
                layanan_id: form.serviceId,
                nik: form.nik,
                nama_lengkap: form.name,
                nomor_kk: form.kk,
                tempat_lahir: form.birthplace,
                tanggal_lahir: form.birthdate,
                jenis_kelamin: form.gender,
                agama: form.religion,
                status_perkawinan: form.maritalStatus,
                pekerjaan: form.job,
                alamat: form.address,
                rt_rw: `${form.rt}/${form.rw}`,
                kelurahan: form.village,
                kecamatan: form.district,
                nomor_hp: form.phone,
                email: form.email,
                jenis_surat: selectedService?.title ?? "",
                keperluan: form.purpose,
                catatan: form.note,
            };
            submissionSchema.parse(payload);
            const ownerId = form.nik || profile?.nik || user?.id || "warga";
            const uploadedPaths: string[] = [];
            const cleanupUploadedFiles = async () => {
                if (uploadedPaths.length === 0) return;
                await removeSubmissionAttachments(uploadedPaths).catch((error) => {
                    if (process.env.NODE_ENV !== "production") console.error("SURAT ONLINE UPLOAD CLEANUP ERROR", error instanceof Error ? error.message : error);
                });
            };

            try {
                if (process.env.NODE_ENV !== "production") console.info("[surat-online]", { stage: "file_upload", bucket: "surat", files: { ktp: Boolean(files.ktp), kk: Boolean(files.kk), pendukung: Boolean(files.support) } });
                const nomorPengajuan = `draft-${Date.now()}`;
                const ktpUpload = files.ktp ? await uploadSubmissionAttachment("ktp", files.ktp, ownerId, nomorPengajuan) : null;
                if (ktpUpload?.path) uploadedPaths.push(ktpUpload.path);
                const kkUpload = files.kk ? await uploadSubmissionAttachment("kk", files.kk, ownerId, nomorPengajuan) : null;
                if (kkUpload?.path) uploadedPaths.push(kkUpload.path);
                const pendukungUpload = files.support ? await uploadSubmissionAttachment("pendukung", files.support, ownerId, nomorPengajuan) : null;
                if (pendukungUpload?.path) uploadedPaths.push(pendukungUpload.path);

                if (process.env.NODE_ENV !== "production") console.info("[surat-online]", { stage: "pengajuan_insert", uploadedPathCount: uploadedPaths.length });
                const result = await createSubmission({
                    ...payload,
                    file_ktp: ktpUpload?.path ?? null,
                    file_kk: kkUpload?.path ?? null,
                    file_pendukung: pendukungUpload?.path ?? null,
                    consent: form.consent,
                    declaration: form.responsibility,
                    physical_proof_generated: form.physicalProofGenerated,
                    physical_proof_viewed: form.physicalProofViewed,
                    physical_proof_approved: form.physicalProofApproved,
                    physical_proof_generated_at: form.physicalProofGeneratedAt,
                    materai_status: "NOT_CONFIGURED",
                }) as SubmissionResult;
                uploadedPaths.length = 0;
                setTicket(result.nomor_pengajuan);
                setSuccessData(result);
                setSubmitted(true);
            } catch (error) {
                await cleanupUploadedFiles();
                throw error;
            }
        } catch (error) {
            if (process.env.NODE_ENV !== "production") console.error("SURAT ONLINE SUBMIT ERROR", error);
            alert(error instanceof Error ? error.message : "Gagal mengirim permohonan.");
        } finally {
            setIsSubmitting(false);
        }
    }

    async function checkStatus() {
        try {
            setStatusChecked(true);
            setStatusLoading(true);
            setStatusError("");
            const query = statusQuery.trim();
            if (!query) {
                setStatusResults([]);
                setStatusError("Masukkan Nomor Pengajuan atau NIK terlebih dahulu.");
                return;
            }
            const data = await searchSubmission(query) as StatusItem[];
            setStatusResults(data);
            setLastStatusQuery(query);
            if (data.length === 0) setStatusError("Nomor pengajuan atau NIK tidak ditemukan.");
        } catch (error) {
            setStatusResults([]);
            setStatusError(error instanceof Error ? error.message : "Gagal mengambil status pengajuan.");
        } finally {
            setStatusLoading(false);
        }
    }

    useEffect(() => {
        if (!profile) return;
        const timeout = window.setTimeout(() => {
            setForm((prev) => ({
                ...prev,
                nik: profile.nik || prev.nik,
                kk: profile.nomor_kk || prev.kk,
                name: profile.nama_lengkap || prev.name,
                birthplace: profile.tempat_lahir || prev.birthplace,
                birthdate: profile.tanggal_lahir || prev.birthdate,
                gender: profile.jenis_kelamin || prev.gender,
                address: profile.alamat || prev.address,
                rt: profile.rt || prev.rt,
                rw: profile.rw || prev.rw,
                village: profile.kelurahan || prev.village,
                district: profile.kecamatan || prev.district,
                phone: profile.nomor_whatsapp || prev.phone,
                email: profile.email || prev.email,
            }));
        }, 0);
        return () => window.clearTimeout(timeout);
    }, [profile]);

    useEffect(() => {
        const nomor = new URLSearchParams(window.location.search).get("nomor");
        if (!nomor) return;
        void Promise.resolve().then(async () => {
            try {
                setStatusQuery(nomor);
                setStatusChecked(true);
                setStatusLoading(true);
                const data = await searchSubmission(nomor);
                const rows = data as StatusItem[];
                setStatusResults(rows);
                setLastStatusQuery(nomor);
                setStatusError(rows.length === 0 ? "Nomor pengajuan atau NIK tidak ditemukan." : "");
                document.getElementById("cek-status")?.scrollIntoView({ behavior: "smooth", block: "start" });
            } catch (error) {
                setStatusResults([]);
                setStatusError(error instanceof Error ? error.message : "Gagal mengambil status pengajuan.");
            } finally {
                setStatusLoading(false);
            }
        });
    }, []);

    useEffect(() => {
        if (!lastStatusQuery) return;
        const client = createSupabaseBrowserClient();
        if (!client) return;
        const refresh = () => {
            searchSubmission(lastStatusQuery)
                .then((data) => setStatusResults(data as StatusItem[]))
                .catch((error: unknown) => setStatusError(error instanceof Error ? error.message : "Realtime gagal memuat status."));
        };
        const channel = client
            .channel(`surat-online-tracking-${lastStatusQuery}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "pengajuan_surat" }, refresh)
            .on("postgres_changes", { event: "*", schema: "public", table: "tracking_pengajuan" }, refresh)
            .on("postgres_changes", { event: "*", schema: "public", table: "dokumen_pengajuan" }, refresh)
            .subscribe();
        return () => {
            void client.removeChannel(channel);
        };
    }, [lastStatusQuery]);

    return (
        <main className="min-h-screen overflow-x-hidden bg-[#f7f4eb] text-slate-800">
            {!formOnly ? <section className="relative overflow-hidden bg-[radial-gradient(circle_at_18%_12%,rgba(226,183,90,.38),transparent_30%),linear-gradient(135deg,#071a33_0%,#0f2f57_50%,#fff7df_50%,#fffaf0_100%)] px-5 pb-16 pt-28 sm:px-10 lg:px-20 lg:pb-24">
                <div className="mx-auto grid max-w-[1440px] gap-10 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
                    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="max-w-3xl">
                        <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-black text-accent-200 backdrop-blur">Portal pelayanan digital</span>
                        <h1 className="mt-6 font-display text-[clamp(36px,6vw,72px)] font-black leading-[1.02] tracking-tight text-white">Ajukan Pelayanan Kelurahan Secara Online</h1>
                        <p className="mt-6 max-w-2xl text-[clamp(18px,2vw,24px)] leading-[1.5] text-slate-100">Pilih jenis pelayanan, lengkapi formulir, unggah persyaratan, lalu pantau status permohonan secara online hingga selesai.</p>
                        <div className="mt-8 grid gap-4 sm:flex sm:flex-wrap">
                            <Button href="#layanan" variant="gold">Ajukan Pelayanan <ArrowRight size={18} /></Button>
                            <Button href="#cek-status" variant="glass">Cek Status Permohonan <Search size={18} /></Button>
                            <Button href={site.wa} variant="glass">Hubungi Petugas <MessageCircle size={18} /></Button>
                        </div>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, scale: 0.96, x: 24 }} animate={{ opacity: 1, scale: 1, x: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="rounded-[32px] border border-white/60 bg-white/85 p-4 shadow-[0_30px_90px_rgba(7,26,51,.25)] backdrop-blur-xl">
                        <div className="rounded-[24px] bg-gov-950 p-5 text-white">
                            <div className="flex items-center justify-between gap-3"><span className="font-black">Dashboard Pengajuan</span><span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-black text-emerald-200">Live</span></div>
                            <div className="mt-6 grid gap-3">{timeline.slice(0, 4).map((item, i) => <div key={item} className="flex items-center gap-3 rounded-2xl bg-white/8 p-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-300 font-black text-gov-950">{i + 1}</span><div className="min-w-0"><p className="truncate font-bold">{item}</p><p className="text-xs text-slate-300">Notifikasi WhatsApp, SMS, Email</p></div></div>)}</div>
                        </div>
                    </motion.div>
                </div>
            </section> : null}

            {!formOnly ? <section className="px-5 py-10 sm:px-10 lg:px-20"><div className="mx-auto grid max-w-[1440px] gap-4 sm:grid-cols-2 lg:grid-cols-4">{stats.map(({ label, icon: Icon }, i) => <motion.div key={label} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.05 }} whileHover={{ scale: 1.03 }} className="min-h-32 rounded-[24px] border border-white bg-white p-5 shadow-soft"><Icon className="text-accent-500" /><p className="mt-4 text-xl font-black text-gov-950">{label}</p></motion.div>)}</div></section> : null}

            {!formOnly ? <section id="layanan" className="px-5 py-14 sm:px-10 lg:px-20"><div className="mx-auto max-w-[1440px]"><div className="max-w-3xl"><span className="font-black uppercase tracking-[.2em] text-accent-600">Pilih pelayanan</span><h2 className="mt-3 font-display text-4xl font-black text-gov-950 md:text-5xl">Satu portal untuk seluruh pengajuan warga.</h2></div><div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{serviceCatalog.map((item, i) => <motion.button key={item.id} type="button" onClick={() => pickService(item.id)} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: Math.min(i * 0.02, 0.25) }} whileHover={{ scale: 1.03 }} className={cn("min-h-[280px] rounded-[24px] border bg-white p-5 text-left shadow-soft transition focus:outline-none focus:ring-4 focus:ring-accent-200", selectedId === item.id ? "border-accent-400" : "border-white")}><div className="grid size-12 place-items-center rounded-2xl bg-gov-950 text-white"><FileText size={22} /></div><h3 className="mt-5 text-xl font-black text-gov-950">{item.title}</h3><p className="mt-3 line-clamp-3 leading-7 text-slate-650">{item.description}</p><p className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent-100 px-3 py-1 text-sm font-black text-gov-950"><Clock size={15} />{item.estimate}</p><span className="mt-5 flex min-h-11 items-center justify-center rounded-2xl bg-gov-950 px-4 text-sm font-black text-white">Ajukan</span></motion.button>)}</div></div></section> : null}

            <section id="form-pengajuan" className={cn("px-5 sm:px-10 lg:px-20", formOnly ? "py-10 pt-28 lg:py-14 lg:pt-32" : "py-14")}><div className={cn("mx-auto grid gap-6", formOnly ? "max-w-5xl" : "max-w-[1440px] lg:grid-cols-[1fr_360px]")}>{formOnly ? <div className="text-center"><span className="font-black uppercase tracking-[.2em] text-accent-600">Pengajuan Layanan</span><h1 className="mt-3 font-display text-3xl font-black text-gov-950 md:text-5xl">{selectedService?.title ?? "Layanan"}</h1></div> : null}<GlassCard className="rounded-[24px] bg-white/90"><Stepper />{submitted ? <Success ticket={ticket} data={successData} service={successData?.jenis_surat ?? selectedService?.title ?? "-"} estimate={selectedService?.estimate ?? "-"} /> : <form onSubmit={submit} className="mt-8 space-y-8"><ApplicantForm form={form} errors={errors} serviceCatalog={serviceCatalog} update={update} setSelectedId={setSelectedId} /><UploadDocs files={files} errors={errors} setFile={setFile} /><Review form={form} service={selectedService?.title ?? "-"} /><AgreementCard form={form} service={selectedService?.title ?? "-"} files={files} errors={errors} update={update} previewOpen={proofPreviewOpen} setPreviewOpen={setProofPreviewOpen} /><Button type="submit" variant="gold" disabled={isSubmitting || !form.consent || !form.responsibility || !form.physicalProofGenerated || !form.physicalProofViewed || !form.physicalProofApproved}>{isSubmitting ? "Mengirim..." : "Saya Setuju & Kirim Permohonan"} <Send size={18} /></Button></form>}</GlassCard>{!formOnly ? <InfoSidebar /> : null}</div></section>

            {!formOnly ? <section id="cek-status" className="px-5 py-16 sm:px-10 lg:px-20"><div className="mx-auto grid max-w-[1440px] gap-6 lg:grid-cols-2"><GlassCard className="rounded-[24px] bg-white/90"><span className="font-black uppercase tracking-[.2em] text-accent-600">Cek Status Permohonan</span><h2 className="mt-3 text-3xl font-black text-gov-950">Pantau progres dengan nomor tiket atau NIK.</h2><div className="mt-6 flex flex-col gap-3 sm:flex-row"><input className={cn(inputClass, "flex-1")} placeholder="Contoh: TMS-2026-123456 atau NIK" value={statusQuery} onChange={(e) => setStatusQuery(e.target.value)} /><Button type="button" onClick={checkStatus} disabled={statusLoading}><Search size={18} />{statusLoading ? "Memuat..." : "Cek Status"}</Button></div>{statusChecked ? <StatusResult results={statusResults} loading={statusLoading} error={statusError} /> : <div className="mt-6 rounded-[24px] border border-dashed border-slate-200 p-6 text-center text-sm font-bold text-slate-500">Empty state: masukkan nomor tiket atau NIK untuk melihat progres permohonan.</div>}</GlassCard><GlassCard className="rounded-[24px] bg-white/90"><h3 className="text-2xl font-black text-gov-950">Status yang tersedia</h3><div className="mt-5 grid gap-3 sm:grid-cols-2">{statusList.map((item) => <div key={item} className="rounded-2xl bg-gov-50 p-4 font-black text-gov-950">{item}</div>)}</div><div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">Error state: nomor tiket tidak ditemukan akan tampil di area ini.</div><div className="mt-3 animate-pulse rounded-2xl bg-slate-100 p-4 text-sm font-bold text-slate-500">Loading skeleton: digunakan saat sistem mengambil data status.</div></GlassCard></div></section> : null}
        </main>
    );
}

function Stepper() {
    return <div className="flex flex-wrap gap-3">{steps.map((step, i) => <div key={step} className="flex min-h-11 flex-1 items-center gap-2 rounded-2xl bg-gov-50 px-3 text-sm font-black text-gov-950"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-300">{i + 1}</span>{step}</div>)}</div>;
}

function ApplicantForm({ form, errors, serviceCatalog, update, setSelectedId }: { form: FormState; errors: Record<string, string>; serviceCatalog: ServiceCatalogItem[]; update: (name: keyof FormState, value: string | boolean) => void; setSelectedId: (id: string) => void }) {
    const fields: [keyof FormState, string][] = [["nik", "NIK"], ["kk", "Nomor KK"], ["name", "Nama Lengkap"], ["birthplace", "Tempat Lahir"], ["birthdate", "Tanggal Lahir"], ["rt", "RT"], ["rw", "RW"], ["village", "Kelurahan"], ["district", "Kecamatan"], ["phone", "Nomor HP"], ["email", "Email"], ["purpose", "Keperluan"]];
    return <div><h2 className="text-2xl font-black text-gov-950">Data Pemohon</h2><div className="mt-5 grid gap-4 md:grid-cols-2"><Field label="Pilih Pelayanan" error={errors.serviceId}><select className={inputClass} value={form.serviceId} onChange={(e) => { update("serviceId", e.target.value); setSelectedId(e.target.value); }}>{serviceCatalog.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></Field>{fields.map(([key, label]) => <Field key={key} label={label} error={errors[key]}><input type={key === "birthdate" ? "date" : key === "email" ? "email" : "text"} inputMode={["nik", "kk", "phone", "rt", "rw"].includes(key) ? "numeric" : undefined} className={inputClass} value={String(form[key])} onChange={(e) => update(key, e.target.value)} /></Field>)}<Field label="Jenis Kelamin" error={errors.gender}><select className={inputClass} value={form.gender} onChange={(e) => update("gender", e.target.value)}><option value="">Pilih</option><option>Laki-laki</option><option>Perempuan</option></select></Field><Field label="Agama" error={errors.religion}><select className={inputClass} value={form.religion} onChange={(e) => update("religion", e.target.value)}><option value="">Pilih</option><option>Islam</option><option>Kristen</option><option>Katolik</option><option>Hindu</option><option>Budha</option><option>Khonghucu</option></select></Field><Field label="Status Perkawinan" error={errors.maritalStatus}><select className={inputClass} value={form.maritalStatus} onChange={(e) => update("maritalStatus", e.target.value)}><option value="">Pilih</option><option>Belum Kawin</option><option>Kawin</option><option>Cerai Hidup</option><option>Cerai Mati</option></select></Field><Field label="Pekerjaan" error={errors.job}><input type="text" className={inputClass} value={form.job} onChange={(e) => update("job", e.target.value)} /></Field><Field label="Jenis Surat"><input type="text" className={inputClass} value={serviceCatalog.find((item) => item.id === form.serviceId)?.title ?? ""} readOnly /></Field><Field label="Alamat" error={errors.address}><textarea className={cn(inputClass, "min-h-28 py-3")} value={form.address} onChange={(e) => update("address", e.target.value)} /></Field><Field label="Catatan"><textarea className={cn(inputClass, "min-h-28 py-3")} value={form.note} onChange={(e) => update("note", e.target.value)} /></Field></div></div>;
}

function UploadDocs({ files, errors, setFile }: { files: UploadState; errors: Record<string, string>; setFile: (key: FileKey, event: ChangeEvent<HTMLInputElement>) => void }) {
    const docs: [FileKey, string][] = [["ktp", "KTP"], ["kk", "KK"], ["support", "Dokumen Pendukung"]];
    return <div><h2 className="text-2xl font-black text-gov-950">Upload Dokumen</h2><div className="mt-5 grid gap-4 md:grid-cols-3">{docs.map(([key, label]) => <label key={key} className="block rounded-[24px] border-2 border-dashed border-slate-200 bg-white p-5 text-center transition hover:border-accent-400 focus-within:ring-4 focus-within:ring-accent-200"><CloudUpload className="mx-auto text-accent-500" size={34} /><span className="mt-3 block font-black text-gov-950">{label}</span><span className="mt-1 block text-xs font-bold text-slate-500">PDF, JPG, PNG maks. 5MB</span><input type="file" accept=".pdf,.jpg,.jpeg,.png" className="sr-only" onChange={(e) => setFile(key, e)} />{files[key] ? <span className="mt-4 block truncate rounded-xl bg-gov-50 px-3 py-2 text-sm font-bold text-gov-950">{files[key]?.name}</span> : <span className="mt-4 block rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-500">Drag & drop / klik upload</span>}{files[key] ? <span className="mt-3 block h-2 overflow-hidden rounded-full bg-slate-100"><span className="block h-full w-full bg-emerald-500" /></span> : null}{errors[key] ? <span className="mt-2 block text-xs font-bold text-red-600">{errors[key]}</span> : null}</label>)}</div></div>;
}

function Review({ form, service }: { form: FormState; service: string }) {
    return <div className="rounded-[24px] bg-gov-50 p-5"><h2 className="text-2xl font-black text-gov-950">Review</h2><div className="mt-4 grid gap-2 text-sm md:grid-cols-2"><p><b>Pelayanan:</b> {service}</p><p><b>Nama:</b> {form.name || "-"}</p><p><b>NIK:</b> {form.nik || "-"}</p><p><b>Nomor HP:</b> {form.phone || "-"}</p></div></div>;
}

function proofHtml(form: FormState, service: string, id: string) {
    const ts = form.physicalProofGeneratedAt || new Date().toISOString();
    return `<!doctype html><html><head><title>Bukti Fisik Permohonan</title><style>body{font-family:Arial,sans-serif;color:#0f172a;padding:32px}.sheet{max-width:760px;margin:auto;border:1px solid #cbd5e1;padding:32px}.center{text-align:center}.row{display:grid;grid-template-columns:180px 1fr;margin:8px 0}.box{border:1px solid #94a3b8;padding:14px;margin:18px 0}.sign{text-align:right;margin-top:42px}</style></head><body><main class="sheet"><p class="center"><b>PEMERINTAH KOTA CILEGON</b><br/>KECAMATAN PULOMERAK<br/>KELURAHAN TAMANSARI</p><h1 class="center">BUKTI FISIK PERMOHONAN</h1><div class="row"><b>Nomor Pengajuan:</b><span>${id}</span></div><div class="row"><b>Jenis Layanan:</b><span>${service}</span></div><h2>DATA PEMOHON</h2><div class="row"><b>Nama:</b><span>${form.name}</span></div><div class="row"><b>NIK:</b><span>${form.nik}</span></div><div class="row"><b>Alamat:</b><span>${form.address}, RT ${form.rt}/RW ${form.rw}, ${form.village}, ${form.district}</span></div><div class="row"><b>Nomor HP:</b><span>${form.phone}</span></div><div class="row"><b>Tanggal Pengajuan:</b><span>${new Date(ts).toLocaleDateString("id-ID")}</span></div><div class="box"><b>PERNYATAAN</b><br/>Saya menyatakan bahwa seluruh data dan dokumen yang saya sampaikan adalah benar dan dapat dipertanggungjawabkan.</div><div class="box"><b>STATUS PERSETUJUAN</b><br/>Data disetujui pemohon<br/>Pemohon menyatakan bertanggung jawab<br/><br/>Tanggal persetujuan: ${new Date(ts).toLocaleString("id-ID")}<br/>Nama pemohon: ${form.name}</div><div class="box"><b>METERAI ELEKTRONIK</b><br/>Status: MENUNGGU METERAI<br/>Meterai elektronik belum dikonfigurasi.</div><div class="sign">Tamansari, ${new Date(ts).toLocaleDateString("id-ID")}<br/><br/><br/><b>${form.name}</b></div></main></body></html>`;
}

function AgreementCard({ form, service, files, errors, update, previewOpen, setPreviewOpen }: { form: FormState; service: string; files: UploadState; errors: Record<string, string>; update: (name: keyof FormState, value: string | boolean) => void; previewOpen: boolean; setPreviewOpen: (value: boolean) => void }) {
    const draftId = `DRAFT-${form.nik || "PEMOHON"}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
    const canGenerate = form.consent && form.responsibility;
    const html = proofHtml(form, service, draftId);
    const download = () => { const win = window.open("", "_blank"); if (!win) return; win.document.write(html); win.document.close(); win.focus(); setTimeout(() => win.print(), 250); };
    const generate = () => { if (!canGenerate) return; update("physicalProofGenerated", true); update("physicalProofGeneratedAt", new Date().toISOString()); update("physicalProofViewed", false); update("physicalProofApproved", false); };
    const view = () => { update("physicalProofViewed", true); setPreviewOpen(true); };
    return <div className="rounded-[28px] border bg-white p-5 shadow-sm sm:p-6"><p className="text-xs font-black uppercase tracking-[.22em] text-accent-600">Persetujuan & Pernyataan</p><h2 className="mt-2 text-2xl font-black text-gov-950">Persetujuan Permohonan</h2><div className="mt-4 grid gap-2 rounded-2xl bg-gov-50 p-4 text-sm font-bold text-gov-950 sm:grid-cols-2"><p>Nama Pemohon: {form.name || "-"}</p><p>NIK: {form.nik || "-"}</p><p>Jenis Layanan: {service}</p><p>Nomor/ID Permohonan: {draftId}</p><p>Tanggal Pengajuan: {new Date().toLocaleDateString("id-ID")}</p><p>Dokumen: {[files.ktp, files.kk, files.support].filter(Boolean).length} berkas</p></div><div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-7"><p>Saya menyatakan bahwa seluruh data dan dokumen yang saya sampaikan dalam permohonan ini adalah benar, lengkap, dan dapat dipertanggungjawabkan.</p><p className="mt-3">Saya bertanggung jawab atas kebenaran data dan dokumen yang saya berikan serta bersedia menerima konsekuensi sesuai ketentuan yang berlaku apabila terdapat data atau dokumen yang tidak benar.</p></div><div className="mt-5 grid gap-3"><label className="flex gap-3 rounded-2xl border p-4 text-sm font-black"><input type="checkbox" checked={form.consent} onChange={(e) => update("consent", e.target.checked)} className="mt-1 size-5 accent-gov-950" />Saya telah membaca dan menyetujui pernyataan di atas.</label>{errors.consent ? <p className="text-sm font-bold text-red-600">{errors.consent}</p> : null}<label className="flex gap-3 rounded-2xl border p-4 text-sm font-black"><input type="checkbox" checked={form.responsibility} onChange={(e) => update("responsibility", e.target.checked)} className="mt-1 size-5 accent-gov-950" />Saya menyatakan bertanggung jawab atas kebenaran data dan dokumen yang saya ajukan.</label>{errors.responsibility ? <p className="text-sm font-bold text-red-600">{errors.responsibility}</p> : null}</div><div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm font-bold"><p className="text-base font-black text-gov-950">Pernyataan Bermaterai</p><p className="mt-2">Untuk permohonan yang memerlukan pernyataan bermaterai, dokumen pernyataan akan diproses menggunakan mekanisme meterai elektronik yang sah sesuai ketentuan yang berlaku.</p><p className="mt-2 text-amber-700">Status: Menunggu proses meterai elektronik / belum dikonfigurasi.</p></div><div className="mt-5 rounded-2xl bg-gov-50 p-4"><p className="font-black text-gov-950">Status Persetujuan</p><div className="mt-3 grid gap-2 text-sm font-bold"><span>{form.consent ? "Pernyataan disetujui" : "Belum menyetujui"}</span><span>{form.responsibility ? "Tanggung jawab disetujui" : "Belum menyatakan tanggung jawab"}</span><span>{form.physicalProofGenerated ? "Bukti fisik dibuat" : "Bukti fisik belum dibuat"}</span><span>{form.physicalProofViewed && form.physicalProofApproved ? "Bukti fisik dilihat dan disetujui" : "Bukti fisik belum disetujui"}</span></div><div className="mt-4 flex flex-col gap-2 sm:flex-row"><Button type="button" variant="primary" disabled={!canGenerate} onClick={generate}><FileText size={18} />Buat Bukti Fisik Permohonan</Button>{form.physicalProofGenerated ? <><Button type="button" variant="glass" onClick={view}><Eye size={18} />Lihat</Button><Button type="button" variant="glass" onClick={download}><Download size={18} />Download</Button><Button type="button" variant="glass" onClick={generate}><RefreshCw size={18} />Buat Ulang</Button></> : null}</div>{errors.physicalProofGenerated ? <p className="mt-2 text-sm font-bold text-red-600">{errors.physicalProofGenerated}</p> : null}{errors.physicalProofApproved ? <p className="mt-2 text-sm font-bold text-red-600">{errors.physicalProofApproved}</p> : null}</div>{form.physicalProofGenerated ? <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-black text-emerald-800"><p>Bukti Fisik Permohonan berhasil dibuat.</p><label className="mt-3 flex gap-3"><input type="checkbox" checked={form.physicalProofApproved} onChange={(e) => update("physicalProofApproved", e.target.checked)} className="mt-1 size-5 accent-emerald-700" />Saya sudah melihat dan menyetujui bukti fisik permohonan.</label></div> : null}{previewOpen ? <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/70 p-4"><div className="mx-auto max-w-4xl rounded-[28px] bg-white p-4 shadow-2xl"><div className="mb-4 flex justify-between gap-3"><h3 className="text-2xl font-black text-gov-950">Bukti Fisik Permohonan</h3><Button type="button" variant="glass" onClick={() => setPreviewOpen(false)}>Tutup</Button></div><iframe title="Bukti Fisik Permohonan" className="h-[70vh] w-full rounded-2xl border" srcDoc={html} /></div></div> : null}</div>;
}

function Success({ ticket, service, estimate, data }: { ticket: string; service: string; estimate: string; data: SubmissionResult | null }) {
    const date = data?.created_at ? new Date(data.created_at) : new Date();
    const serviceName = data?.layanan?.nama ?? data?.jenis_surat ?? service;
    const serviceEstimate = data?.layanan?.output?.replace(/^Estimasi\s+/i, "") ?? estimate;
    const trackingUrl = data?.tracking_url ?? `${window.location.origin}/surat-online/tracking?nomor=${encodeURIComponent(ticket)}`;
    const [qrDataUrl, setQrDataUrl] = useState("");
    const [previewOpen, setPreviewOpen] = useState(false);
    useEffect(() => {
        QRCode.toDataURL(trackingUrl, { margin: 1, width: 220 })
            .then(setQrDataUrl)
            .catch(() => setQrDataUrl(""));
    }, [trackingUrl]);
    const printData = { ...(data ?? {}), nomor_pengajuan: ticket, tracking_url: trackingUrl, jenis_surat: serviceName, created_at: data?.created_at ?? date.toISOString() };
    return <div className="mt-8 rounded-[24px] border border-emerald-200 bg-emerald-50 p-6"><CheckCircle2 className="text-emerald-600" size={40} /><h2 className="mt-4 text-3xl font-black text-gov-950">Permohonan berhasil dikirim</h2><div className="mt-5 grid gap-3 md:grid-cols-2"><p><b>Nomor Pengajuan:</b> {ticket}</p><p><b>Tanggal:</b> {date.toLocaleDateString("id-ID")}</p><p><b>Jenis Pelayanan:</b> {serviceName}</p><p><b>Estimasi selesai:</b> {serviceEstimate}</p><p><b>Link Tracking:</b> <a className="underline" href={trackingUrl}>{trackingUrl}</a></p></div><div className="mt-6 flex flex-wrap gap-3"><div className="grid size-28 place-items-center rounded-3xl bg-white text-gov-950">{qrDataUrl ? <Image src={qrDataUrl} alt="QR Code tracking pengajuan" width={96} height={96} unoptimized className="size-24" /> : <QrCode size={76} />}</div><Button type="button" variant="primary" title="Cetak atau simpan bukti pengajuan sebagai PDF" className="w-full sm:w-auto" onClick={() => setPreviewOpen(true)}><Printer size={18} />Cetak Bukti Pengajuan</Button></div>{previewOpen ? <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm no-print"><div className="mx-auto max-w-5xl rounded-[28px] bg-white p-4 shadow-2xl sm:p-6"><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-black uppercase tracking-[.18em] text-accent-600">Pratinjau Bukti Pengajuan</p><h3 className="text-2xl font-black text-gov-950">Dokumen A4 siap cetak</h3></div><div className="flex flex-col gap-2 sm:flex-row"><Button type="button" variant="glass" onClick={() => setPreviewOpen(false)}>Tutup</Button><Button type="button" variant="primary" title="Cetak atau simpan bukti pengajuan sebagai PDF" onClick={() => window.print()}><Printer size={18} />Cetak Bukti</Button></div></div><div className="max-h-[78vh] overflow-auto rounded-2xl bg-slate-100 p-3"><BuktiPengajuanPrint data={printData} serviceName={serviceName} qrDataUrl={qrDataUrl} className="mx-auto" /></div></div></div> : null}<div className="print-only-holder" aria-hidden={!previewOpen}><BuktiPengajuanPrint data={printData} serviceName={serviceName} qrDataUrl={qrDataUrl} /></div></div>;
}

function InfoSidebar() {
    return <aside className="space-y-5"><GlassCard className="rounded-[24px] bg-white/90"><h3 className="text-xl font-black text-gov-950">Sidebar Informasi</h3><div className="mt-5 space-y-4 text-sm font-bold text-slate-650"><p className="flex gap-3"><ShieldCheck className="shrink-0 text-accent-500" />Persyaratan mengikuti jenis pelayanan yang dipilih.</p><p className="flex gap-3"><Clock className="shrink-0 text-accent-500" />Jam pelayanan: Senin-Jumat 08.00-15.30 WIB.</p><p className="flex gap-3"><Phone className="shrink-0 text-accent-500" />Kontak: {site.phone}</p><Link href="/faq" className="flex gap-3 hover:text-gov-950"><HelpCircle className="shrink-0 text-accent-500" />FAQ pelayanan</Link><Link href="/posbankum" className="flex gap-3 hover:text-gov-950"><Scale className="shrink-0 text-accent-500" />POSBANKUM</Link></div></GlassCard><GlassCard className="rounded-[24px] bg-gov-950 text-white"><h3 className="text-xl font-black">Notifikasi</h3><p className="mt-3 text-sm leading-7 text-slate-300">Placeholder integrasi status melalui WhatsApp, SMS, dan Email.</p><div className="mt-4 flex gap-2"><MessageCircle /><Phone /><Mail /></div></GlassCard></aside>;
}

function StatusResult({ results, loading, error }: { results: StatusItem[]; loading: boolean; error: string }) {
    const [qrDataUrl, setQrDataUrl] = useState("");
    const [previewOpen, setPreviewOpen] = useState(false);
    const item = results[0];
    const trackingUrlForQr = item?.nomor_pengajuan ? item.tracking_url ?? `${window.location.origin}/surat-online/tracking?nomor=${encodeURIComponent(item.nomor_pengajuan)}` : "";
    useEffect(() => {
        if (!trackingUrlForQr) return;
        QRCode.toDataURL(trackingUrlForQr, { margin: 1, width: 220 })
            .then(setQrDataUrl)
            .catch(() => setQrDataUrl(""));
    }, [trackingUrlForQr]);
    if (loading) return <div className="mt-6 animate-pulse rounded-[24px] bg-slate-100 p-5 text-sm font-bold text-slate-500">Mengambil data status pengajuan...</div>;
    if (error) return <div className="mt-6 rounded-[24px] bg-red-50 p-5 text-sm font-bold text-red-700">{error}</div>;
    if (!item) return <div className="mt-6 rounded-[24px] border border-dashed border-slate-200 p-6 text-center text-sm font-bold text-slate-500">Data tidak ditemukan.</div>;
    const tracking = [...(item.tracking_pengajuan ?? [])].sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime());
    const latest = tracking.at(-1);
    const currentStatus = item.status ?? latest?.status ?? "Menunggu Verifikasi";
    const stepMap: Record<string, number> = { "Menunggu Verifikasi": 1, Verifikasi: 2, Diproses: 3, Ditandatangani: 4, Selesai: 5, Ditolak: 0 };
    const progress = currentStatus === "Ditolak" ? 0 : (stepMap[currentStatus] ?? Math.max(latest?.progress ?? 1, 1));
    const stepsToShow = currentStatus === "Ditolak" ? [...timeline, "Ditolak"] : timeline;
    const trackingUrl = trackingUrlForQr;
    const serviceName = item.layanan?.nama ?? item.jenis_surat ?? "-";
    const printData = { ...item, tracking_url: trackingUrl, jenis_surat: serviceName, status: currentStatus };
    return <div className="mt-6 rounded-[24px] bg-gov-50 p-5"><p className="font-black text-gov-950">Status: {currentStatus}</p><p className="mt-2 text-sm font-bold text-slate-650">Nomor: {item.nomor_pengajuan} • Petugas: {latest?.petugas ?? item.petugas ?? "-"} • Realtime aktif</p><div className="mt-4 h-3 overflow-hidden rounded-full bg-white"><div className={cn("h-full", currentStatus === "Ditolak" ? "bg-red-500" : currentStatus === "Selesai" ? "bg-emerald-500" : "bg-gov-500")} style={{ width: `${currentStatus === "Ditolak" ? 100 : Math.min(progress * 20, 100)}%` }} /></div><div className="mt-5 grid gap-3">{stepsToShow.map((step, i) => { const active = step === "Ditolak" ? currentStatus === "Ditolak" : i < progress; return <div key={step} className="flex items-start gap-3"><span className={cn("grid size-8 shrink-0 place-items-center rounded-full", active ? currentStatus === "Ditolak" && step === "Ditolak" ? "bg-red-500 text-white" : currentStatus === "Selesai" ? "bg-emerald-500 text-white" : "bg-gov-500 text-white" : "bg-white text-slate-400")}><Check size={16} /></span><span className="font-bold"><span className="block">{step}</span>{tracking[i] ? <span className="block text-xs text-slate-500">{tracking[i].created_at ? new Date(tracking[i].created_at).toLocaleString("id-ID") : "-"} • {tracking[i].keterangan ?? "-"} • Petugas: {tracking[i].petugas ?? "-"}</span> : null}</span></div>; })}</div><div className="mt-5 flex flex-col gap-2 sm:flex-row"><Button type="button" variant="primary" title="Cetak atau simpan bukti pengajuan sebagai PDF" className="w-full sm:w-auto" onClick={() => setPreviewOpen(true)}><Printer size={18} />Cetak Bukti Pengajuan</Button></div><div className="mt-5 rounded-2xl bg-white p-4"><p className="font-black text-gov-950">Dokumen</p><div className="mt-2 grid gap-2 text-sm font-bold">{(item.dokumen_pengajuan ?? []).map((doc) => { const url = doc.url_file ?? doc.file_url ?? "#"; return <a key={`${doc.jenis ?? doc.jenis_dokumen}-${url}`} className="text-gov-950 underline" href={url} target="_blank" rel="noreferrer">{doc.jenis ?? doc.jenis_dokumen ?? doc.nama_file ?? "Dokumen"}</a>; })}</div></div>{previewOpen ? <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm no-print"><div className="mx-auto max-w-5xl rounded-[28px] bg-white p-4 shadow-2xl sm:p-6"><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-black uppercase tracking-[.18em] text-accent-600">Pratinjau Bukti Pengajuan</p><h3 className="text-2xl font-black text-gov-950">Dokumen A4 siap cetak</h3></div><div className="flex flex-col gap-2 sm:flex-row"><Button type="button" variant="glass" onClick={() => setPreviewOpen(false)}>Tutup</Button><Button type="button" variant="primary" title="Cetak atau simpan bukti pengajuan sebagai PDF" onClick={() => window.print()}><Printer size={18} />Cetak Bukti</Button></div></div><div className="max-h-[78vh] overflow-auto rounded-2xl bg-slate-100 p-3"><BuktiPengajuanPrint data={printData} serviceName={serviceName} qrDataUrl={qrDataUrl} className="mx-auto" /></div></div></div> : null}<div className="print-only-holder" aria-hidden={!previewOpen}><BuktiPengajuanPrint data={printData} serviceName={serviceName} qrDataUrl={qrDataUrl} /></div></div>;
}