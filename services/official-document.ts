import { MASTER_LAYANAN } from "@/constants/master-layanan";

export type DocumentValues = Record<string, string | number | null | undefined>;

export type TemplateStatus = "READY" | "DRAFT" | "PERLU REVIEW" | "CONFIGURATION_REQUIRED" | "TEMPLATE BELUM TERSEDIA" | "ARCHIVED";
export type TemplateField = {
    name: string;
    label: string;
    type: "text" | "textarea" | "date" | "select" | "number";
    required?: boolean;
    options?: string[];
    source?: "submission" | "additional";
};

export type OfficialServiceTemplate = {
    serviceId: string;
    templateId: string;
    version: number;
    title: string;
    body: string;
    source: string;
    serviceName?: string;
    fieldSchema?: TemplateField[];
    status?: TemplateStatus;
    numbering?: { classification: string; suffix: string; width: number } | null;
};

export type NumberingConfig = { classification: string; suffix: string; width: number };

export function isVerificationToken(value: unknown): value is string {
    return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function isFinalDocument(row: Record<string, any> | null | undefined): row is Record<string, any> {
    return Boolean(row && String(row.status).toUpperCase() === "SELESAI" && row.document_locked === true && row.issued_at && isVerificationToken(row.verification_token));
}

export function validateReadyTemplate(input: { templateId: string; version: number; content: string; source: string; schema: TemplateField[]; signerRole?: string; numbering?: Partial<NumberingConfig> | null }) {
    if (!input.templateId || !/^[A-Z][A-Z0-9_]*$/.test(input.templateId)) throw new Error("Template ID READY tidak valid.");
    if (!Number.isInteger(input.version) || input.version < 1) throw new Error("Versi template READY tidak valid.");
    if (!input.content.trim()) throw new Error("Isi naskah resmi wajib diisi untuk READY.");
    if (!input.source.trim()) throw new Error("Referensi naskah resmi wajib diisi untuk READY.");
    if (input.signerRole !== "LURAH") throw new Error("Signer READY wajib ber-role LURAH.");
    if (!Array.isArray(input.schema) || input.schema.length === 0) throw new Error("Field schema READY wajib tersedia dan tidak boleh kosong.");
    for (const field of input.schema) {
        if (!field || !/^[a-z][a-z0-9_]*$/.test(field.name) || !String(field.label ?? "").trim() || !["text", "textarea", "date", "select", "number"].includes(field.type)) throw new Error("Field schema READY mengandung definisi yang tidak valid.");
    }
    assertTemplateContentSafe(input.content, input.schema);
    const numbering = input.numbering;
    const width = Number(numbering?.width);
    if (!numbering || !String(numbering.classification ?? "").trim() || !String(numbering.suffix ?? "").trim() || !Number.isInteger(width) || width < 1 || width > 12) {
        throw new Error("numbering_config READY wajib lengkap: classification, suffix, dan width 1-12.");
    }
}

/**
 * Registry ini sengaja fail-closed. Template hanya boleh ditambahkan setelah naskah resmi
 * disahkan; nama/output pada tabel layanan bukan naskah surat dan tidak boleh dijadikan isi palsu.
 */
export type MasterTemplateConfig = {
    serviceName: string;
    templateId: string;
    version: number;
    masterTemplateId: "DOMISILI_OFFICIAL_V1";
    layoutEngine: "DOMISILI_MASTER";
    fields: readonly string[];
    manuscriptStatus: "READY" | "CONFIGURATION_REQUIRED";
    publicationStatus: "READY" | "CONFIGURATION_REQUIRED";
    sourceFiles: readonly string[];
};

const IDENTITY_FIELDS = ["nik", "nama_lengkap", "tempat_lahir", "tanggal_lahir", "jenis_kelamin", "agama", "status_perkawinan", "pekerjaan", "alamat", "keperluan"] as const;
const OFFICIAL_REFERENCE_NAMES = new Set([
    "PENERBITAN SURAT KETERANGAN DOMISILI", "PENERBITAN SURAT KETERANGAN BELUM MEMPUNYAI PEKERJAAN",
    "PENERBITAN SURAT KETERANGAN BELUM MEMILIKI RUMAH", "PENERBITAN SURAT KETERANGAN BELUM PERNAH MENIKAH",
    "PENERBITAN SURAT KETERANGAN GHAIB", "PENERBITAN SURAT KETERANGAN KELAHIRAN", "PENERBITAN SURAT KETERANGAN KEMATIAN",
    "PENERBITAN SURAT PENGANTAR NIKAH, TALAK, CERAI, RUJUK", "PENERBITAN SURAT REKOMENDASI IJIN KEGIATAN / KERAMAIAN",
]);

function registryId(urutan: number, name: string) {
    const base = name.replace(/^PENERBITAN |^PERMOHONAN |^PENANDATANGAN |^PENGESAHAN /, "").replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
    return `${base.slice(0, 48)}_OFFICIAL_V1_${urutan}`;
}

function fieldsFor(name: string): readonly string[] {
    if (/KELAHIRAN/.test(name)) return [...IDENTITY_FIELDS, "nama_bayi", "nama_ayah", "nama_ibu", "nama_pelapor", "saksi_1", "saksi_2"];
    if (/KEMATIAN/.test(name)) return [...IDENTITY_FIELDS, "nama_jenazah", "tanggal_kematian", "tempat_kematian", "nama_pelapor", "saksi_1", "saksi_2"];
    if (/PENGANTAR NIKAH/.test(name)) return [...IDENTITY_FIELDS, "nama_calon_pasangan", "status_orang_tua", "model_n1", "model_n2", "model_n3", "model_n4"];
    if (/REKOMENDASI IJIN/.test(name)) return ["nama_lengkap", "nik", "alamat", "keperluan", "nama_acara", "hiburan", "waktu_mulai", "waktu_selesai", "lokasi_acara", "ketentuan_acara"];
    if (/BELUM MEMPUNYAI PEKERJAAN/.test(name)) return [...IDENTITY_FIELDS, "status_penghasilan"];
    if (/BELUM MEMILIKI RUMAH/.test(name)) return [...IDENTITY_FIELDS, "status_kepemilikan_rumah"];
    return [...IDENTITY_FIELDS];
}

/** Code-only registry: authoritative manuscript content remains in service_templates. */
export const MASTER_TEMPLATE_REGISTRY: readonly MasterTemplateConfig[] = MASTER_LAYANAN.map((service) => {
    const ready = OFFICIAL_REFERENCE_NAMES.has(service.nama);
    return { serviceName: service.nama, templateId: service.nama === "PENERBITAN SURAT KETERANGAN DOMISILI" ? "DOMISILI_OFFICIAL_V1" : registryId(service.urutan, service.nama), version: 1, masterTemplateId: "DOMISILI_OFFICIAL_V1", layoutEngine: "DOMISILI_MASTER", fields: fieldsFor(service.nama), manuscriptStatus: ready ? "READY" : "CONFIGURATION_REQUIRED", publicationStatus: ready ? "READY" : "CONFIGURATION_REQUIRED", sourceFiles: ready ? ["PDF referensi pengguna (perlu verifikasi admin)"] : [] };
});

export function getMasterTemplateConfig(serviceName?: string | null) {
    return MASTER_TEMPLATE_REGISTRY.find((entry) => entry.serviceName === serviceName) ?? null;
}

export const OFFICIAL_SERVICE_TEMPLATES: Readonly<Record<string, OfficialServiceTemplate>> = {};

export function getOfficialServiceTemplate(serviceId?: string | null) {
    return serviceId ? OFFICIAL_SERVICE_TEMPLATES[serviceId] ?? null : null;
}

export const OFFICIAL_DOCUMENT_PLACEHOLDERS = [
    "nomor_surat", "tanggal_surat", "nama", "nik", "tempat_lahir", "tanggal_lahir",
    "jenis_kelamin", "agama", "status_perkawinan", "status_pekerjaan", "pekerjaan", "alamat", "alamat_asal", "rt", "rw",
    "kelurahan", "kecamatan", "kota", "provinsi", "keperluan", "tanggal_surat",
    "nama_lengkap", "tempat_tanggal_surat", "lurah_name", "signer_nip",
    "nama_lurah", "nip_lurah", "jabatan_lurah", "verification_url",
    "verification_code", "qr_code",
] as const;

/** Satu renderer untuk seluruh layanan; isi spesifik tetap berasal dari data layanan/pengajuan terverifikasi. */
export function renderDocumentTemplate(template: string, values: DocumentValues) {
    return template.replace(/{{\s*([a-z0-9_]+)\s*}}/gi, (_, key: string) => String(values[key] ?? "-"));
}

const LOCKED_IDENTITY_FIELDS = new Set(["nik", "nama", "nama_lengkap", "tempat_lahir", "tanggal_lahir", "jenis_kelamin", "agama", "status_perkawinan", "status_pekerjaan", "pekerjaan", "alamat", "rt", "rw", "kelurahan", "kecamatan"]);
export const PROFILE_TEMPLATE_FIELDS = new Set(["alamat_asal", "alamat_sekarang"]);

export function validateTemplateFields(schema: TemplateField[], input: Record<string, unknown>, profileValues: Record<string, unknown> = {}) {
    const values: Record<string, string> = {};
    for (const field of schema) {
        if (!/^[a-z][a-z0-9_]*$/.test(field.name) || (field.source !== "submission" && LOCKED_IDENTITY_FIELDS.has(field.name))) {
            throw new Error(`Field template tidak diizinkan: ${field.name}`);
        }
        const rawValue = PROFILE_TEMPLATE_FIELDS.has(field.name) && Object.prototype.hasOwnProperty.call(profileValues, field.name)
            ? profileValues[field.name]
            : input[field.name];
        const value = typeof rawValue === "string" ? rawValue.trim() : "";
        if (field.required && !value) throw new Error(`${field.label} wajib diisi.`);
        if (field.type === "select" && value && !field.options?.includes(value)) throw new Error(`${field.label} tidak valid.`);
        values[field.name] = value;
    }
    return values;
}

export function templateFromRow(row: Record<string, any> | null): OfficialServiceTemplate | null {
    if (!row || row.status !== "READY" || !String(row.template_content ?? "").trim() || !String(row.source_reference ?? "").trim()) return null;
    const fieldSchema: TemplateField[] = (Array.isArray(row.field_schema) ? row.field_schema : [])
        .map((field: Record<string, unknown>) => ({
            ...field,
            name: String(field.name ?? field.key ?? ""),
            label: String(field.label ?? field.name ?? field.key ?? ""),
            type: (field.type === "textarea" || field.type === "date" || field.type === "select" || field.type === "number" ? field.type : "text") as TemplateField["type"],
            required: Boolean(field.required),
            options: Array.isArray(field.options) ? field.options : [],
            source: (field.source === "submission" ? "submission" : "additional") as TemplateField["source"],
        }))
        .filter((field) => Boolean(field.name));
    return {
        serviceId: String(row.service_id), templateId: String(row.template_id),
        version: Number(row.template_version), title: String(row.service_name),
        serviceName: String(row.service_name), body: String(row.template_content),
        source: String(row.source_reference), fieldSchema,
        status: row.status,
        numbering: row.numbering_config && typeof row.numbering_config === "object" ? row.numbering_config : null,
    };
}

export async function getActiveServiceTemplate(client: any, serviceId?: string | null) {
    if (!serviceId) return null;
    const { data, error } = await client.from("service_templates").select("*").eq("service_id", serviceId).eq("is_active", true).maybeSingle();
    if (error) throw new Error(error.message);
    return templateFromRow(data);
}

export function templateSnapshot(template: OfficialServiceTemplate) {
    return {
        service_id: template.serviceId,
        service_name: template.serviceName ?? template.title,
        template_id: template.templateId,
        template_version: template.version,
        field_schema: template.fieldSchema ?? [],
        template_content: template.body,
        source_reference: template.source,
        signer_role: "LURAH",
        status: "READY",
        numbering_config: template.numbering ?? null,
    };
}

export function templateFromSnapshot(snapshot: Record<string, any> | null | undefined): OfficialServiceTemplate | null {
    if (!snapshot || snapshot.status !== "READY" || !String(snapshot.template_content ?? "").trim()) return null;
    return {
        serviceId: String(snapshot.service_id),
        serviceName: String(snapshot.service_name),
        templateId: String(snapshot.template_id),
        version: Number(snapshot.template_version),
        title: String(snapshot.service_name),
        body: String(snapshot.template_content),
        source: String(snapshot.source_reference ?? "Snapshot dokumen"),
        fieldSchema: Array.isArray(snapshot.field_schema) ? snapshot.field_schema : [],
        status: "READY",
        numbering: snapshot.numbering_config && typeof snapshot.numbering_config === "object" ? snapshot.numbering_config : null,
    };
}

export function assertTemplateContentSafe(content: string, schema: TemplateField[]) {
    const allowed = new Set<string>([...OFFICIAL_DOCUMENT_PLACEHOLDERS, ...schema.map((field) => field.name)]);
    const used = [...content.matchAll(/{{\s*([a-z0-9_]+)\s*}}/gi)].map((match) => match[1]);
    const invalid = used.filter((key) => !allowed.has(key));
    if (invalid.length) throw new Error(`Placeholder tidak dikenal: ${[...new Set(invalid)].join(", ")}`);
}

export function mapDocumentValues(row: Record<string, any>, signer?: { nama: string; nip: string; jabatan: string }, verification?: Record<string, string>) {
    return {
        ...(row.additional_data ?? {}),
        nama: row.nama_lengkap ?? row.nama, nama_lengkap: row.nama_lengkap ?? row.nama,
        nik: row.nik, tempat_lahir: row.tempat_lahir,
        tanggal_lahir: row.tanggal_lahir, jenis_kelamin: row.jenis_kelamin, agama: row.agama,
        status_perkawinan: row.status_perkawinan ?? row.additional_data?.status_perkawinan,
        status_pekerjaan: row.status_pekerjaan ?? row.additional_data?.status_pekerjaan,
        alamat: row.alamat,
        rt: row.rt, rw: row.rw, kelurahan: row.kelurahan, kecamatan: row.kecamatan,
        kota: "Cilegon", provinsi: "Banten", alamat_asal: row.alamat_asal ?? row.alamat,
        alamat_sekarang: row.alamat_sekarang ?? row.alamat, keperluan: row.keperluan,
        nomor_surat: row.nomor_surat, tanggal_surat: row.tanggal_surat,
        tempat_tanggal_surat: row.tempat_tanggal_surat ?? (row.tempat_lahir && row.tanggal_lahir ? `${row.tempat_lahir}, ${row.tanggal_lahir}` : "-"),
        lurah_name: signer?.nama ?? row.lurah_name ?? row.nama_lurah,
        signer_nip: signer?.nip ?? row.signer_nip ?? row.nip_lurah,
        nama_lurah: signer?.nama ?? row.lurah_name ?? row.nama_lurah,
        nip_lurah: signer?.nip ?? row.signer_nip ?? row.nip_lurah,
        jabatan_lurah: signer?.jabatan ?? row.signer_jabatan,
        ...(verification ?? {}),
    } satisfies DocumentValues;
}

export function signerFromProfile(profile: { role?: string | null; nama_lengkap?: string | null; nip?: string | null; jabatan?: string | null }) {
    const role = String(profile.role ?? "").trim().toLowerCase();
    const nama = profile.nama_lengkap?.trim();
    const nip = profile.nip?.trim();
    const jabatan = profile.jabatan?.trim();
    if (role !== "lurah" || !nama || !nip || !jabatan) throw new Error("Data authoritative Lurah (nama, NIP, jabatan, dan role) belum lengkap.");
    return { role: "LURAH" as const, jabatan, nama, nip };
}

export function verificationCode(token: string) {
    return token.replace(/-/g, "").toUpperCase();
}