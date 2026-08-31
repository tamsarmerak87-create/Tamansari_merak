"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";

type Field = { name: string; label: string; type: "text" | "textarea" | "date" | "select" | "number"; required?: boolean; source?: "submission" | "additional" };
type Template = { template_id: string; template_version: number; field_schema: Field[]; template_content: string | null; source_reference: string | null; signer_role: string; status: string; is_active?: boolean };
type MasterTemplate = { templateId: string; version: number; masterTemplateId: string; layoutEngine: string; manuscriptStatus: string; publicationStatus: string; fields: string[] };

const baseFields: Field[] = [
    { name: "keperluan", label: "Keperluan", type: "textarea", required: true, source: "submission" },
];

export default function TemplatePage() {
    const { id } = useParams<{ id: string }>();
    const [service, setService] = useState<{ nama: string } | null>(null);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [masterTemplate, setMasterTemplate] = useState<MasterTemplate | null>(null);
    const [form, setForm] = useState<Template>({ template_id: "", template_version: 1, field_schema: baseFields, template_content: "", source_reference: "", signer_role: "LURAH", status: "TEMPLATE BELUM TERSEDIA" });
    const [message, setMessage] = useState("");
    const load = async () => { const r = await fetch(`/api/admin/layanan/${id}/template`); const j = await r.json(); if (!r.ok) return setMessage(j.error ?? "Gagal memuat template"); setService(j.data.service); setMasterTemplate(j.data.masterTemplate); setTemplates(j.data.templates); if (j.data.templates[0]) setForm(j.data.templates[0]); else if (j.data.masterTemplate) setForm(current => ({ ...current, template_id: j.data.masterTemplate.templateId, template_version: j.data.masterTemplate.version, field_schema: j.data.masterTemplate.fields.map((name: string) => ({ name, label: name.replaceAll("_", " "), type: name === "keperluan" || name === "alamat" ? "textarea" : "text", required: true, source: ["nik", "nama_lengkap", "tempat_lahir", "tanggal_lahir", "jenis_kelamin", "agama", "status_perkawinan", "pekerjaan", "alamat", "keperluan"].includes(name) ? "submission" : "additional" })) })); };
    useEffect(() => { if (id) void Promise.resolve().then(load); }, [id]);
    const update = (key: keyof Template, value: unknown) => setForm((current) => ({ ...current, [key]: value }));
    const save = async () => { setMessage("Menyimpan..."); const r = await fetch(`/api/admin/layanan/${id}/template`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(form) }); const j = await r.json(); setMessage(r.ok ? "Template tersimpan." : (j.error ?? "Gagal menyimpan.")); if (r.ok) load(); };
    return <main className="min-h-screen bg-slate-50 p-6 text-slate-900"><div className="mx-auto max-w-6xl space-y-6">
        <a href="/admin/layanan" className="inline-flex items-center gap-2 font-bold text-gov-950"><ArrowLeft size={18} /> Kembali ke layanan</a>
        <header><p className="text-sm font-black uppercase tracking-widest text-accent-700">Admin Master Template</p><h1 className="text-3xl font-black">{service?.nama ?? "Memuat layanan..."}</h1><p className="mt-2 text-sm text-slate-600">Simpan hanya naskah resmi. Template READY wajib memiliki referensi resmi.</p>{masterTemplate && <div className="mt-4 grid gap-2 rounded-2xl bg-white p-4 text-sm shadow-sm md:grid-cols-3"><span><b>Template ID:</b> {masterTemplate.templateId}</span><span><b>Master engine:</b> {masterTemplate.masterTemplateId}</span><span><b>Versi:</b> v{masterTemplate.version}</span><span><b>Status naskah:</b> {masterTemplate.manuscriptStatus}</span><span><b>Siap penerbitan:</b> {masterTemplate.publicationStatus === "READY" ? "Ya" : "Tidak"}</span><span><b>Layout:</b> {masterTemplate.layoutEngine}</span></div>}</header>
        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-3xl bg-white p-6 shadow-sm"><h2 className="mb-4 text-xl font-black">Konfigurasi</h2><div className="space-y-4">
                <label className="block text-sm font-bold">Template ID<input className="mt-1 w-full rounded-xl border p-3" value={form.template_id} onChange={e => update("template_id", e.target.value.toUpperCase())} placeholder="SK_DOMISILI" /></label>
                <label className="block text-sm font-bold">Versi<input type="number" min="1" className="mt-1 w-full rounded-xl border p-3" value={form.template_version} onChange={e => update("template_version", Number(e.target.value))} /></label>
                <label className="block text-sm font-bold">Status<select className="mt-1 w-full rounded-xl border p-3" value={form.status} onChange={e => update("status", e.target.value)}>{["READY", "DRAFT", "PERLU REVIEW", "TEMPLATE BELUM TERSEDIA"].map(s => <option key={s}>{s}</option>)}</select></label>
                <label className="block text-sm font-bold">Referensi naskah resmi<input className="mt-1 w-full rounded-xl border p-3" value={form.source_reference ?? ""} onChange={e => update("source_reference", e.target.value)} placeholder="URL/nomor dokumen resmi" /></label>
                <div className="rounded-2xl bg-slate-100 p-4 text-xs leading-6"><b>Placeholder identitas:</b> {"{{nama}} {{nik}} {{tempat_lahir}} {{tanggal_lahir}} {{jenis_kelamin}} {{agama}} {{status_perkawinan}} {{status_pekerjaan}} {{pekerjaan}} {{alamat}} {{rt}} {{rw}} {{kelurahan}} {{kecamatan}} {{kota}} {{provinsi}}"}<br /><b>Surat:</b> {"{{keperluan}} {{nomor_surat}} {{tanggal_surat}}"}<br /><b>Lurah/verifikasi:</b> {"{{nama_lurah}} {{nip_lurah}} {{jabatan_lurah}} {{verification_url}} {{verification_code}} {{qr_code}}"}</div>
            </div></div>
            <div className="rounded-3xl bg-white p-6 shadow-sm"><h2 className="mb-4 text-xl font-black">Isi Template</h2><textarea className="min-h-[430px] w-full rounded-2xl border p-4 font-mono text-sm" value={form.template_content ?? ""} onChange={e => update("template_content", e.target.value)} placeholder="Masukkan naskah resmi dengan placeholder standar..." /><button onClick={save} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gov-950 px-5 py-3 font-black text-white"><Save size={17} /> Simpan Template</button>{message && <p className="mt-3 text-sm font-bold">{message}</p>}</div>
        </section>
        <section className="rounded-3xl bg-white p-6 shadow-sm"><h2 className="mb-4 text-xl font-black">Audit dan Preview</h2><div className="grid gap-4 md:grid-cols-2"><div className="rounded-2xl bg-slate-50 p-4 text-sm leading-7"><b>Penandatangan:</b> {form.signer_role}<br /><b>Status:</b> {form.status}<br /><b>Sumber:</b> {form.source_reference || "Belum tersedia"}<br /><b>Field:</b> {form.field_schema.map(field => field.label).join(", ") || "Tidak ada"}</div><pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">{form.template_content || "Preview belum tersedia."}</pre></div></section>
        <section className="rounded-3xl bg-white p-6 shadow-sm"><h2 className="mb-4 text-xl font-black">Riwayat Versi</h2><div className="overflow-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-3">ID</th><th className="p-3">Versi</th><th className="p-3">Status</th><th className="p-3">Aktif</th></tr></thead><tbody>{templates.map(t => <tr key={`${t.template_id}-${t.template_version}`} className="border-b"><td className="p-3 font-bold">{t.template_id}</td><td className="p-3">v{t.template_version}</td><td className="p-3">{t.status}</td><td className="p-3">{t.is_active ? "Ya" : "Tidak"}</td></tr>)}</tbody></table></div></section>
    </div></main>;
}