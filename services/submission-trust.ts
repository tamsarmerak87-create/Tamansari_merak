import { MASTER_LAYANAN } from "@/constants/master-layanan";

export type ServiceStatementConfig = {
    statement: string;
    requiresMaterai: boolean;
    requiresSignature: boolean;
};

const SPECIAL_STATEMENTS: Record<string, string> = {
    "PENERBITAN SURAT KETERANGAN DOMISILI": "Saya menyatakan bahwa saya berdomisili pada alamat yang tercantum dalam data permohonan dan seluruh keterangan yang saya berikan adalah benar.",
    "PENERBITAN SURAT KETERANGAN BELUM PERNAH MENIKAH": "Saya menyatakan bahwa sampai dengan saat pernyataan ini dibuat, saya belum pernah menikah dan seluruh keterangan yang diberikan adalah benar.",
    "PENERBITAN SURAT KETERANGAN USAHA": "Saya menyatakan bahwa usaha dan keterangan usaha yang saya sampaikan benar-benar ada dan dapat dipertanggungjawabkan.",
    "PENERBITAN SURAT KETERANGAN KEHILANGAN": "Saya menyatakan bahwa barang atau dokumen yang dilaporkan hilang benar hilang dan kronologi yang disampaikan adalah benar.",
    "PENERBITAN SURAT PENGANTAR NIKAH, TALAK, CERAI, RUJUK": "Saya menyatakan bahwa seluruh data calon pengantin, pernikahan, orang tua/wali, dan dokumen yang saya berikan adalah benar serta menjadi tanggung jawab saya sebagai pemohon.",
};

export const MASTER_PERNYATAAN_LAYANAN: Readonly<Record<string, ServiceStatementConfig>> = Object.freeze(
    Object.fromEntries(MASTER_LAYANAN.map(({ nama }) => [nama, {
        statement: SPECIAL_STATEMENTS[nama] ?? `Saya menyatakan bahwa seluruh data dan keterangan untuk ${nama.toLocaleLowerCase("id-ID")} yang saya berikan adalah benar dan dapat dipertanggungjawabkan.`,
        requiresMaterai: false,
        requiresSignature: false,
    }])),
);

export function getServiceStatement(serviceName: string): ServiceStatementConfig {
    return MASTER_PERNYATAAN_LAYANAN[serviceName.trim().toLocaleUpperCase("id-ID")] ?? {
        statement: "Saya menyatakan bahwa data dan keterangan yang saya berikan dalam permohonan ini adalah benar dan dapat dipertanggungjawabkan.",
        requiresMaterai: false,
        requiresSignature: false,
    };
}

export type ProviderEvidence = { transactionId: string; evidenceUrl: string; verifiedAt: string };
export interface ElectronicMateraiProvider { createTransaction(submissionId: string): Promise<{ status: "MENUNGGU PEMBAYARAN" }>; verify(transactionId: string): Promise<ProviderEvidence | null>; }
export interface ElectronicSignatureProvider { requestSignature(submissionId: string): Promise<{ status: "MENUNGGU TANDA TANGAN" }>; verify(transactionId: string): Promise<ProviderEvidence | null>; }

export function hasValidProviderEvidence(evidence: ProviderEvidence | null | undefined) {
    return Boolean(evidence?.transactionId.trim() && /^https:\/\//i.test(evidence.evidenceUrl) && !Number.isNaN(Date.parse(evidence.verifiedAt)));
}