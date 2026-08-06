"use client";

import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { jsPDF } from "jspdf";
import {
    ArrowRight,
    Bell,
    Check,
    CheckCircle2,
    Clock,
    CloudUpload,
    Download,
    FileCheck2,
    FileText,
    HelpCircle,
    Mail,
    MessageCircle,
    Phone,
    Printer,
    QrCode,
    Scale,
    Search,
    Send,
    ShieldCheck,
    XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/card";
import { site } from "@/constants/site";
import { createSubmission, searchSubmission, submissionSchema } from "@/services/surat-online.service";
import type { PublicService } from "@/types";
import { cn } from "@/utils/cn";
import QRCode from "qrcode";

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
    };
}

const stats = [
    { label: "33 Pelayanan", icon: FileCheck2 },
    { label: "Pengajuan Online", icon: Send },
    { label: "Tracking Status", icon: Search },
    { label: "Respon Cepat", icon: Bell },
];

const steps = ["Pilih Pelayanan", "Isi Data Pemohon", "Upload Dokumen", "Review", "Kirim Permohonan"];
const timeline = ["Permohonan Diterima", "Verifikasi", "Diproses", "Ditandatangani", "Selesai"];
const statusList = ["Menunggu", "Diproses", "Verifikasi", "Ditolak", "Selesai"];
const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];

type FormState = ReturnType<typeof createEmptyForm>;
type FileKey = "ktp" | "kk" | "support";
type UploadState = Record<FileKey, File | null>;
type SubmissionResult = Record<string, unknown> & {
    nomor_pengajuan: string;
    created_at?: string;
    nama_lengkap?: string;
    nik?: string;
    jenis_surat?: string;
    status?: string;
    petugas?: string | null;
};
type TrackingItem = { status?: string; progress?: number; petugas?: string | null; created_at?: string; catatan?: string | null };
type DocumentItem = { jenis_dokumen?: string; file_url?: string; created_at?: string };
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

export default function SuratOnlineClient({ services }: { services: PublicService[] }) {
    const serviceCatalog = useMemo<ServiceCatalogItem[]>(() => services.filter((item) => item.category === "administrasi").slice(0, 33).map((item, index) => ({
        ...item,
        estimate: item.output?.replace(/^Estimasi\s+/i, "") || (index % 3 === 0 ? "1 hari kerja" : index % 3 === 1 ? "2 hari kerja" : "3 hari kerja"),
    })), [services]);
    const firstServiceId = serviceCatalog[0]?.id ?? "";
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
        const parsed = submissionSchema.safeParse(payload);
        if (!parsed.success) {
            parsed.error.issues.forEach((issue) => {
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
        if (!form.consent) next.consent = "Checklist persetujuan wajib dicentang";
        setErrors(next);
        return Object.keys(next).length === 0;
    }

    async function submit(e: FormEvent) {
        e.preventDefault();
        try {
            if (!validate()) return;
            setIsSubmitting(true);
            const formData = new FormData();
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
            Object.entries(payload).forEach(([key, value]) => formData.append(key, value));
            if (files.ktp) formData.append("ktp", files.ktp);
            if (files.kk) formData.append("kk", files.kk);
            if (files.support) formData.append("pendukung", files.support);
            const result = await createSubmission(formData) as SubmissionResult;
            setTicket(result.nomor_pengajuan);
            setSuccessData(result);
            setSubmitted(true);
        } catch (error) {
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
            const data = await searchSubmission(statusQuery) as StatusItem[];
            setStatusResults(data);
            if (data.length === 0) setStatusError("Nomor pengajuan atau NIK tidak ditemukan.");
        } catch (error) {
            setStatusResults([]);
            setStatusError(error instanceof Error ? error.message : "Gagal mengambil status pengajuan.");
        } finally {
            setStatusLoading(false);
        }
    }

    return (
        <main className="min-h-screen overflow-x-hidden bg-[#f7f4eb] text-slate-800">
            <section className="relative overflow-hidden bg-[radial-gradient(circle_at_18%_12%,rgba(226,183,90,.38),transparent_30%),linear-gradient(135deg,#071a33_0%,#0f2f57_50%,#fff7df_50%,#fffaf0_100%)] px-5 pb-16 pt-28 sm:px-10 lg:px-20 lg:pb-24">
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
            </section>

            <section className="px-5 py-10 sm:px-10 lg:px-20"><div className="mx-auto grid max-w-[1440px] gap-4 sm:grid-cols-2 lg:grid-cols-4">{stats.map(({ label, icon: Icon }, i) => <motion.div key={label} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.05 }} whileHover={{ scale: 1.03 }} className="min-h-32 rounded-[24px] border border-white bg-white p-5 shadow-soft"><Icon className="text-accent-500" /><p className="mt-4 text-xl font-black text-gov-950">{label}</p></motion.div>)}</div></section>

            <section id="layanan" className="px-5 py-14 sm:px-10 lg:px-20"><div className="mx-auto max-w-[1440px]"><div className="max-w-3xl"><span className="font-black uppercase tracking-[.2em] text-accent-600">Pilih pelayanan</span><h2 className="mt-3 font-display text-4xl font-black text-gov-950 md:text-5xl">Satu portal untuk seluruh pengajuan warga.</h2></div><div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{serviceCatalog.map((item, i) => <motion.button key={item.id} type="button" onClick={() => pickService(item.id)} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: Math.min(i * 0.02, 0.25) }} whileHover={{ scale: 1.03 }} className={cn("min-h-[280px] rounded-[24px] border bg-white p-5 text-left shadow-soft transition focus:outline-none focus:ring-4 focus:ring-accent-200", selectedId === item.id ? "border-accent-400" : "border-white")}><div className="grid size-12 place-items-center rounded-2xl bg-gov-950 text-white"><FileText size={22} /></div><h3 className="mt-5 text-xl font-black text-gov-950">{item.title}</h3><p className="mt-3 line-clamp-3 leading-7 text-slate-650">{item.description}</p><p className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent-100 px-3 py-1 text-sm font-black text-gov-950"><Clock size={15} />{item.estimate}</p><span className="mt-5 flex min-h-11 items-center justify-center rounded-2xl bg-gov-950 px-4 text-sm font-black text-white">Ajukan</span></motion.button>)}</div></div></section>

            <section id="form-pengajuan" className="px-5 py-14 sm:px-10 lg:px-20"><div className="mx-auto grid max-w-[1440px] gap-6 lg:grid-cols-[1fr_360px]"><GlassCard className="rounded-[24px] bg-white/90"><Stepper />{submitted ? <Success ticket={ticket} data={successData} service={successData?.jenis_surat ?? selectedService?.title ?? "-"} estimate={selectedService?.estimate ?? "-"} /> : <form onSubmit={submit} className="mt-8 space-y-8"><ApplicantForm form={form} errors={errors} serviceCatalog={serviceCatalog} update={update} setSelectedId={setSelectedId} /><UploadDocs files={files} errors={errors} setFile={setFile} /><Review form={form} service={selectedService?.title ?? "-"} error={errors.consent} update={update} /><Button type="submit" variant="gold" disabled={isSubmitting}>{isSubmitting ? "Mengirim..." : "Kirim Permohonan"} <Send size={18} /></Button></form>}</GlassCard><InfoSidebar /></div></section>

            <section id="cek-status" className="px-5 py-16 sm:px-10 lg:px-20"><div className="mx-auto grid max-w-[1440px] gap-6 lg:grid-cols-2"><GlassCard className="rounded-[24px] bg-white/90"><span className="font-black uppercase tracking-[.2em] text-accent-600">Cek Status Permohonan</span><h2 className="mt-3 text-3xl font-black text-gov-950">Pantau progres dengan nomor tiket atau NIK.</h2><div className="mt-6 flex flex-col gap-3 sm:flex-row"><input className={cn(inputClass, "flex-1")} placeholder="Contoh: TMS-2026-123456 atau NIK" value={statusQuery} onChange={(e) => setStatusQuery(e.target.value)} /><Button type="button" onClick={checkStatus} disabled={statusLoading}><Search size={18} />{statusLoading ? "Memuat..." : "Cek Status"}</Button></div>{statusChecked ? <StatusResult results={statusResults} loading={statusLoading} error={statusError} /> : <div className="mt-6 rounded-[24px] border border-dashed border-slate-200 p-6 text-center text-sm font-bold text-slate-500">Empty state: masukkan nomor tiket atau NIK untuk melihat progres permohonan.</div>}</GlassCard><GlassCard className="rounded-[24px] bg-white/90"><h3 className="text-2xl font-black text-gov-950">Status yang tersedia</h3><div className="mt-5 grid gap-3 sm:grid-cols-2">{statusList.map((item) => <div key={item} className="rounded-2xl bg-gov-50 p-4 font-black text-gov-950">{item}</div>)}</div><div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">Error state: nomor tiket tidak ditemukan akan tampil di area ini.</div><div className="mt-3 animate-pulse rounded-2xl bg-slate-100 p-4 text-sm font-bold text-slate-500">Loading skeleton: digunakan saat sistem mengambil data status.</div></GlassCard></div></section>
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

function Review({ form, service, error, update }: { form: FormState; service: string; error?: string; update: (name: keyof FormState, value: string | boolean) => void }) {
    return <div className="rounded-[24px] bg-gov-50 p-5"><h2 className="text-2xl font-black text-gov-950">Review</h2><div className="mt-4 grid gap-2 text-sm md:grid-cols-2"><p><b>Pelayanan:</b> {service}</p><p><b>Nama:</b> {form.name || "-"}</p><p><b>NIK:</b> {form.nik || "-"}</p><p><b>Nomor HP:</b> {form.phone || "-"}</p></div><label className="mt-5 flex items-start gap-3 text-sm font-bold text-gov-950"><input type="checkbox" className="mt-1 size-5 rounded border-slate-300 accent-gov-950" checked={form.consent} onChange={(e) => update("consent", e.target.checked)} />Saya menyatakan data benar.</label>{error ? <p className="mt-2 text-sm font-bold text-red-600">{error}</p> : null}</div>;
}

function Success({ ticket, service, estimate, data }: { ticket: string; service: string; estimate: string; data: SubmissionResult | null }) {
    const date = data?.created_at ? new Date(data.created_at) : new Date();
    async function downloadProof() {
        try {
            const qr = await QRCode.toDataURL(ticket);
            const pdf = new jsPDF();
            pdf.setFillColor(7, 26, 51);
            pdf.rect(0, 0, 210, 32, "F");
            pdf.setTextColor(255, 255, 255);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(16);
            pdf.text("KELURAHAN TAMANSARI", 20, 15);
            pdf.setFontSize(10);
            pdf.text("Bukti Pengajuan Surat Online", 20, 23);
            pdf.setTextColor(15, 23, 42);
            pdf.setFontSize(12);
            const rows = [["Nomor Pengajuan", ticket], ["Nama", data?.nama_lengkap ?? "-"], ["NIK", data?.nik ?? "-"], ["Jenis Pelayanan", service], ["Tanggal", date.toLocaleDateString("id-ID")], ["Status", data?.status ?? "Menunggu Verifikasi"]];
            rows.forEach(([label, value], index) => {
                const y = 52 + index * 12;
                pdf.setFont("helvetica", "bold");
                pdf.text(label, 20, y);
                pdf.setFont("helvetica", "normal");
                pdf.text(String(value), 78, y);
            });
            pdf.addImage(qr, "PNG", 148, 48, 38, 38);
            pdf.setFontSize(9);
            pdf.text("QR Code berisi nomor pengajuan untuk verifikasi status.", 20, 138);
            pdf.save(`bukti-${ticket}.pdf`);
        } catch (error) {
            alert(error instanceof Error ? error.message : "Gagal membuat PDF bukti pengajuan.");
        }
    }
    return <div className="mt-8 rounded-[24px] border border-emerald-200 bg-emerald-50 p-6"><CheckCircle2 className="text-emerald-600" size={40} /><h2 className="mt-4 text-3xl font-black text-gov-950">Permohonan berhasil dikirim</h2><div className="mt-5 grid gap-3 md:grid-cols-2"><p><b>Nomor Tiket:</b> {ticket}</p><p><b>Tanggal:</b> {date.toLocaleDateString("id-ID")}</p><p><b>Jenis Pelayanan:</b> {service}</p><p><b>Estimasi selesai:</b> {estimate}</p></div><div className="mt-6 flex flex-wrap gap-3"><div className="grid size-28 place-items-center rounded-3xl bg-white text-gov-950"><QrCode size={76} /></div><Button type="button" variant="primary" onClick={downloadProof}><Download size={18} />Download Bukti Pengajuan</Button><Button type="button" variant="glass" onClick={() => window.print()}><Printer size={18} />Cetak Bukti</Button></div></div>;
}

function InfoSidebar() {
    return <aside className="space-y-5"><GlassCard className="rounded-[24px] bg-white/90"><h3 className="text-xl font-black text-gov-950">Sidebar Informasi</h3><div className="mt-5 space-y-4 text-sm font-bold text-slate-650"><p className="flex gap-3"><ShieldCheck className="shrink-0 text-accent-500" />Persyaratan mengikuti jenis pelayanan yang dipilih.</p><p className="flex gap-3"><Clock className="shrink-0 text-accent-500" />Jam pelayanan: Senin-Jumat 08.00-15.30 WIB.</p><p className="flex gap-3"><Phone className="shrink-0 text-accent-500" />Kontak: {site.phone}</p><Link href="/faq" className="flex gap-3 hover:text-gov-950"><HelpCircle className="shrink-0 text-accent-500" />FAQ pelayanan</Link><Link href="/posbankum" className="flex gap-3 hover:text-gov-950"><Scale className="shrink-0 text-accent-500" />POSBANKUM</Link></div></GlassCard><GlassCard className="rounded-[24px] bg-gov-950 text-white"><h3 className="text-xl font-black">Notifikasi</h3><p className="mt-3 text-sm leading-7 text-slate-300">Placeholder integrasi status melalui WhatsApp, SMS, dan Email.</p><div className="mt-4 flex gap-2"><MessageCircle /><Phone /><Mail /></div></GlassCard></aside>;
}

function StatusResult({ results, loading, error }: { results: StatusItem[]; loading: boolean; error: string }) {
    if (loading) return <div className="mt-6 animate-pulse rounded-[24px] bg-slate-100 p-5 text-sm font-bold text-slate-500">Mengambil data status pengajuan...</div>;
    if (error) return <div className="mt-6 rounded-[24px] bg-red-50 p-5 text-sm font-bold text-red-700">{error}</div>;
    const item = results[0];
    if (!item) return <div className="mt-6 rounded-[24px] border border-dashed border-slate-200 p-6 text-center text-sm font-bold text-slate-500">Data tidak ditemukan.</div>;
    const tracking = [...(item.tracking_pengajuan ?? [])].sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime());
    const latest = tracking.at(-1);
    const progress = Math.max(latest?.progress ?? 1, 1);
    return <div className="mt-6 rounded-[24px] bg-gov-50 p-5"><p className="font-black text-gov-950">Status: {item.status ?? latest?.status ?? "Menunggu Verifikasi"}</p><p className="mt-2 text-sm font-bold text-slate-650">Nomor: {item.nomor_pengajuan} • Petugas: {latest?.petugas ?? item.petugas ?? "-"}</p><div className="mt-4 h-3 overflow-hidden rounded-full bg-white"><div className="h-full bg-gradient-to-r from-accent-300 to-emerald-500" style={{ width: `${Math.min(progress * 20, 100)}%` }} /></div><div className="mt-5 grid gap-3">{timeline.map((step, i) => <div key={step} className="flex items-start gap-3"><span className={cn("grid size-8 shrink-0 place-items-center rounded-full", i < progress ? "bg-emerald-500 text-white" : "bg-white text-slate-400")}><Check size={16} /></span><span className="font-bold"><span className="block">{step}</span>{tracking[i] ? <span className="block text-xs text-slate-500">{tracking[i].created_at ? new Date(tracking[i].created_at).toLocaleString("id-ID") : "-"} • {tracking[i].catatan ?? "-"} • Petugas: {tracking[i].petugas ?? "-"}</span> : null}</span></div>)}</div><div className="mt-5 rounded-2xl bg-white p-4"><p className="font-black text-gov-950">Dokumen</p><div className="mt-2 grid gap-2 text-sm font-bold">{(item.dokumen_pengajuan ?? []).map((doc) => <a key={`${doc.jenis_dokumen}-${doc.file_url}`} className="text-gov-950 underline" href={doc.file_url} target="_blank" rel="noreferrer">{doc.jenis_dokumen ?? "Dokumen"}</a>)}</div></div></div>;
}