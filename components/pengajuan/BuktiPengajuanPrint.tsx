"use client";

import Image from "next/image";
import { Check, Circle, Dot } from "lucide-react";
import { cn } from "@/utils/cn";

export type BuktiTrackingItem = {
    status?: string;
    keterangan?: string | null;
    petugas?: string | null;
    created_at?: string;
};

export type BuktiPengajuanData = {
    nomor_pengajuan: string;
    nomor_tiket?: string;
    tracking_url?: string;
    created_at?: string;
    nama_lengkap?: string;
    nik?: string;
    nomor_kk?: string;
    tempat_lahir?: string;
    tanggal_lahir?: string;
    jenis_kelamin?: string;
    agama?: string;
    status_perkawinan?: string;
    pekerjaan?: string;
    alamat?: string;
    rt?: string;
    rw?: string;
    kelurahan?: string;
    kecamatan?: string;
    no_hp?: string;
    nomor_hp?: string;
    email?: string;
    keperluan?: string;
    status?: string;
    layanan?: { nama?: string; output?: string } | null;
    jenis_surat?: string;
    tracking_pengajuan?: BuktiTrackingItem[];
};

type BuktiPengajuanPrintProps = {
    data: BuktiPengajuanData;
    serviceName?: string;
    qrDataUrl?: string;
    className?: string;
};

const workflowSteps = ["Staff Pelayanan", "Petugas Lapangan", "Kepala Seksi", "Seklur", "Lurah"];

function formatDate(value?: string, withTime = false) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    }).format(date);
}

function maskNik(value?: string) {
    if (!value) return "-";
    if (value.length < 8) return value;
    return `${value.slice(0, 4)}${"x".repeat(Math.max(value.length - 8, 0))}${value.slice(-4)}`;
}

function statusLabel(status?: string) {
    return (status ?? "Menunggu Verifikasi").toUpperCase();
}

function normalizeStatus(status?: string) {
    return (status ?? "").trim().toLowerCase();
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
    return (
        <div className="bukti-info-row">
            <span>{label}</span>
            <strong>{value || "-"}</strong>
        </div>
    );
}

export function BuktiPengajuanPrint({ data, serviceName, qrDataUrl, className }: BuktiPengajuanPrintProps) {
    const tracking = [...(data.tracking_pengajuan ?? [])].sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime());
    const latest = tracking.at(-1);
    const currentStatus = data.status ?? latest?.status ?? "Menunggu Verifikasi";
    const trackingUrl = data.tracking_url ?? (typeof window !== "undefined" ? `${window.location.origin}/surat-online/tracking?nomor=${encodeURIComponent(data.nomor_pengajuan)}` : `/surat-online/tracking?nomor=${encodeURIComponent(data.nomor_pengajuan)}`);
    const layanan = data.layanan?.nama ?? data.jenis_surat ?? serviceName ?? "-";
    const createdAt = data.created_at ?? latest?.created_at;
    const rtRw = [data.rt, data.rw].filter(Boolean).join("/");
    const ttl = [data.tempat_lahir, formatDate(data.tanggal_lahir)].filter((item) => item && item !== "-").join(", ");
    const completedSteps = new Set(tracking.map((item) => normalizeStatus(item.petugas || item.status)));
    const activeStep = currentStatus === "Menunggu Verifikasi" ? "staff pelayanan" : normalizeStatus(latest?.petugas || latest?.status);

    return (
        <article className={cn("print-bukti-pengajuan bukti-page", className)}>
            <header className="bukti-header">
                <div className="bukti-logo-wrap">
                    <Image src="/assets/logo-cilegon.png" alt="Logo Pemerintah Kota Cilegon" width={74} height={74} className="bukti-logo" priority />
                </div>
                <div className="bukti-kop">
                    <p>PEMERINTAH KOTA CILEGON</p>
                    <p>KECAMATAN PULOMERAK</p>
                    <h1>KELURAHAN TAMANSARI</h1>
                    <span>Kecamatan Pulomerak - Kota Cilegon</span>
                </div>
            </header>

            <section className="bukti-title">
                <span>DOKUMEN ELEKTRONIK</span>
                <h2>BUKTI PENGAJUAN</h2>
                <h3>PELAYANAN ONLINE</h3>
                <p>Kelurahan Tamansari - Kecamatan Pulomerak - Kota Cilegon</p>
                <strong>{data.nomor_pengajuan}</strong>
                <small>Tanggal Pengajuan: {formatDate(createdAt)}</small>
            </section>

            <section className="bukti-section">
                <h4>DATA PEMOHON</h4>
                <div className="bukti-grid">
                    <InfoRow label="Nama Lengkap" value={data.nama_lengkap} />
                    <InfoRow label="NIK" value={maskNik(data.nik)} />
                    <InfoRow label="No. KK" value={maskNik(data.nomor_kk)} />
                    <InfoRow label="Tempat/Tanggal Lahir" value={ttl} />
                    <InfoRow label="Jenis Kelamin" value={data.jenis_kelamin} />
                    <InfoRow label="Agama" value={data.agama} />
                    <InfoRow label="Pekerjaan" value={data.pekerjaan} />
                    <InfoRow label="RT/RW" value={rtRw} />
                    <InfoRow label="Kelurahan" value={data.kelurahan} />
                    <InfoRow label="Kecamatan" value={data.kecamatan} />
                    <InfoRow label="No. HP" value={data.no_hp ?? data.nomor_hp} />
                    <InfoRow label="Email" value={data.email} />
                    <InfoRow label="Alamat" value={data.alamat} />
                </div>
            </section>

            <section className="bukti-section bukti-service">
                <h4>DATA PELAYANAN</h4>
                <InfoRow label="Nama Layanan" value={layanan} />
                <InfoRow label="Keperluan" value={data.keperluan} />
                <InfoRow label="Tanggal Pengajuan" value={formatDate(createdAt, true)} />
                <div className="bukti-status-row">
                    <span>Status</span>
                    <strong>{statusLabel(currentStatus)}</strong>
                </div>
            </section>

            <section className="bukti-section">
                <h4>TRACKING PENGAJUAN</h4>
                <div className="bukti-timeline">
                    {tracking.length > 0 ? tracking.map((item, index) => (
                        <div key={`${item.status}-${item.created_at}-${index}`} className="bukti-timeline-item done">
                            <Check size={14} />
                            <div>
                                <strong>{item.status ?? "Pengajuan Diterima"}</strong>
                                <span>{formatDate(item.created_at, true)}{item.petugas ? ` - Petugas: ${item.petugas}` : ""}</span>
                                {item.keterangan ? <small>{item.keterangan}</small> : null}
                            </div>
                        </div>
                    )) : (
                        <div className="bukti-timeline-item done">
                            <Check size={14} />
                            <div><strong>Pengajuan Diterima</strong><span>{formatDate(createdAt, true)}</span></div>
                        </div>
                    )}
                    {workflowSteps.map((step) => {
                        const key = normalizeStatus(step);
                        const isDone = completedSteps.has(key);
                        const isActive = !isDone && activeStep === key;
                        return (
                            <div key={step} className={cn("bukti-timeline-item", isDone ? "done" : isActive ? "active" : "pending")}>
                                {isDone ? <Check size={14} /> : isActive ? <Dot size={18} /> : <Circle size={12} />}
                                <div><strong>{step}</strong><span>{isActive ? "Menunggu proses" : ""}</span></div>
                            </div>
                        );
                    })}
                </div>
            </section>

            <section className="bukti-section bukti-qr-section">
                <div>
                    <h4>QR CODE</h4>
                    <p>Scan untuk melihat status pengajuan</p>
                    <strong>{data.nomor_pengajuan}</strong>
                    <span>{trackingUrl}</span>
                </div>
                <div className="bukti-qr-box">
                    {qrDataUrl ? <Image src={qrDataUrl} alt="QR Code tracking pengajuan" width={126} height={126} unoptimized /> : null}
                </div>
            </section>

            <footer className="bukti-footer">
                <p><strong>Catatan:</strong> Simpan bukti ini sebagai tanda pengajuan. Status dapat dipantau secara online.</p>
                <p>Dicetak dari Portal Pelayanan Digital Kelurahan Tamansari.</p>
                <p><strong>Kelurahan Tamansari</strong><br />Kecamatan Pulomerak<br />Kota Cilegon</p>
                <small>Dokumen ini merupakan bukti pengajuan pelayanan dan bukan merupakan surat keputusan.</small>
            </footer>
        </article>
    );
}