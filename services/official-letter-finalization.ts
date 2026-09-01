import { NextResponse, type NextRequest } from "next/server";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { randomUUID } from "node:crypto";
import { getAdminSession, isPetugas, type PetugasProfile } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";
import { getActiveStage, isFinalSubmissionStatus, normalizeWorkflowRole } from "@/services/verification-workflow";
import { assertTemplateContentSafe, getActiveServiceTemplate, mapDocumentValues, renderDocumentTemplate, signerFromProfile, templateFromSnapshot, templateSnapshot, validateTemplateFields, verificationCode } from "@/services/official-document";
import { SUBMISSION_DOCUMENT_BUCKET } from "@/services/submission-storage";
import { renderOfficialLetterPdf } from "@/services/official-letter-pdf";
import { sendApplicationStatusEmailSafely, statusEmailInputFromSubmission } from "@/services/email.service";

type AnyRow = Record<string, any>;
function jsonError(message: string, status = 400) { return NextResponse.json({ ok: false, error: message }, { status }); }
async function writeAudit(supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, payload: Record<string, unknown>) { const { error } = await supabase.from("audit_pengajuan").insert(payload); if (error) console.error("Audit surat gagal disimpan:", error.message); }
function pickName(row: AnyRow) { return row.nama_pemohon ?? row.nama_lengkap ?? row.nama ?? "-"; }
function pickLayanan(row: AnyRow) { const l = Array.isArray(row.layanan) ? row.layanan[0] : row.layanan; return l?.nama ?? row.jenis_surat ?? "Surat Keterangan"; }
const LETTER_STORAGE_BUCKET = SUBMISSION_DOCUMENT_BUCKET;
type LetterStorageOperation = "draft_pdf" | "final_pdf" | "qr" | "cleanup_qr" | "cleanup_final_pdf" | "signed_url";
function logLetterStorage(operation: LetterStorageOperation, path: string) {
    console.info("[LETTER STORAGE]", { operation, bucket: LETTER_STORAGE_BUCKET, objectAvailable: Boolean(path) });
}
function logLetterStorageError(operation: LetterStorageOperation, path: string, error: AnyRow) {
    console.error("[LETTER STORAGE ERROR]", {
        operation,
        bucket: LETTER_STORAGE_BUCKET,
        objectAvailable: Boolean(path),
        message: error?.message ?? "Unknown storage error",
        statusCode: error?.statusCode ?? null,
        name: error?.name ?? null,
    });
}
function logFinalize(marker: "START" | "QR" | "PDF RENDER" | "PDF UPLOAD" | "DOCUMENT" | "SUBMISSION" | "SUCCESS" | "ERROR", id: string, details?: Record<string, unknown>) {
    console.info(`[FINALIZE ${marker}]`, { pengajuanId: id, ...details });
}
function logFinalizeStep(step: "LOAD_SERVICE" | "LOAD_TEMPLATE" | "CREATE_DRAFT" | "LOAD_PROFILE" | "VALIDATE_TEMPLATE" | "CLAIM_NUMBER") {
    console.info(`[FINALIZE STEP] ${step}`);
}

function buildPdf(row: AnyRow, template: NonNullable<Awaited<ReturnType<typeof getActiveServiceTemplate>>>, version: number) {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const layanan = pickLayanan(row);
    doc.setFont("helvetica", "bold"); doc.setFontSize(14);
    doc.text("PEMERINTAH KOTA CILEGON", 105, 18, { align: "center" });
    doc.text("KELURAHAN TAMANSARI", 105, 28, { align: "center" });
    doc.line(20, 38, 190, 38);
    doc.setFontSize(16); doc.text("DRAFT - BELUM DITANDATANGANI", 105, 50, { align: "center" });
    doc.setFontSize(13); doc.text(String(template.title || layanan).toUpperCase(), 105, 62, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(11);
    doc.text(`Nomor Pengajuan: ${row.nomor_pengajuan ?? row.id}`, 20, 72);
    const content = renderDocumentTemplate(template.body, mapDocumentValues(row));
    doc.text(doc.splitTextToSize(content, 170), 20, 78);
    doc.text("DRAFT - tidak berlaku sebagai dokumen resmi sebelum disetujui Lurah.", 20, 165, { maxWidth: 170 });
    doc.text(`Cilegon, ${new Date().toLocaleDateString("id-ID")}`, 140, 190);
    doc.text("Lurah Tamansari", 140, 202);
    doc.setFont("helvetica", "bold"); doc.text("(Menunggu TTD Lurah)", 140, 225);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.text(`DRAFT v${version} - surat-hasil-pelayanan.pdf`, 20, 282);
    return Buffer.from(doc.output("arraybuffer"));
}

type InternalFinalization = {
    id: string;
    actorProfile: PetugasProfile;
    signerProfile: PetugasProfile;
    catatan?: string;
};

export function finalizeOfficialLetter(request: NextRequest, options: InternalFinalization) {
    return handleOfficialLetter(request, { params: Promise.resolve({ id: options.id }) }, options).catch((error: unknown) => {
        const normalizedError = error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : { name: typeof error, message: String(error), stack: undefined };
        console.error("[FINALIZE UNHANDLED ERROR]", { pengajuanId: options.id, ...normalizedError });
        return jsonError("Finalisasi surat gagal karena kesalahan server.", 500);
    });
}

export async function handleOfficialLetterPost(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    return handleOfficialLetter(request, context);
}

async function handleOfficialLetter(request: NextRequest, context: { params: Promise<{ id: string }> }, internal?: InternalFinalization) {
    const { id } = await context.params;
    const session = internal
        ? { error: null, profile: internal.actorProfile }
        : await getAdminSession(request, { cookie: "petugas" });
    if (session.error || !session.profile) return jsonError("Session petugas tidak valid.", 401);
    if (!internal && !isPetugas(session.profile)) return jsonError("Akses khusus petugas.", 403);
    const workflowRole = normalizeWorkflowRole(session.profile.role);
    // Admin workflow control is authorized by the admin route. An internal
    // invocation must retain the authenticated admin as actor while using the
    // authoritative Lurah profile as signer; admin is not a signer workflow role.
    if (!internal && !workflowRole) return jsonError("Role tidak memiliki kewenangan workflow.", 403);

    const supabase = createSupabaseAdminClient();
    if (!supabase) return jsonError("Supabase service role belum dikonfigurasi.", 500);

    const body = internal
        ? { action: "approve" as const, catatan: internal.catatan }
        : await request.json().catch(() => ({})) as { action?: "generate" | "confirm" | "approve" | "reject" | "return"; catatan?: string; nomor_surat?: unknown };
    if (Object.prototype.hasOwnProperty.call(body, "nomor_surat")) return jsonError("Nomor surat final hanya dapat dialokasikan oleh server.", 400);
    const { data: existingDocs } = await supabase.from("dokumen_pengajuan").select("*").eq("pengajuan_id", id);
    const letterDocs = (existingDocs ?? []).filter((d: AnyRow) => /surat hasil pelayanan/i.test(`${d.jenis ?? ""} ${d.nama_file ?? ""}`));
    let activeDraft = letterDocs.find((d: AnyRow) => ["DRAFT", "DRAFT_DIVERIFIKASI_STAFF", "DRAFT_DIVERIFIKASI_LAPANGAN", "DRAFT_DIVERIFIKASI_KASI", "DRAFT_DIVERIFIKASI_SEKLUR", "SIAP_DIVERIFIKASI", "SIAP_TTD"].includes(String(d.status)) && d.metadata?.active !== false);
    const activeReady = letterDocs.find((d: AnyRow) => ["SIGNED", "TERBIT", "FINAL"].includes(String(d.status)));

    const now = new Date().toISOString();
    if (["approve", "reject", "return"].includes(String(body.action))) {
        if (!internal && workflowRole !== "lurah") return jsonError("Hanya Lurah yang dapat mengambil keputusan final.", 403);
        const { data: pengajuan, error: pengajuanError } = await supabase.from("pengajuan_surat").select("*, layanan(*)").eq("id", id).maybeSingle();
        if (pengajuanError) return jsonError(pengajuanError.message, 500);
        if (!pengajuan) return jsonError("Pengajuan tidak ditemukan.", 404);
        if (isFinalSubmissionStatus(pengajuan.status) || pengajuan.document_locked) return jsonError("Dokumen sudah final dan terkunci.", 409);
        const { data: stages, error: stagesError } = await supabase.from("verifikasi_pengajuan").select("id,tahap,nama_tahap,role_petugas,status").eq("pengajuan_id", id).order("tahap");
        if (stagesError) return jsonError(stagesError.message, 500);
        const activeStage = getActiveStage(stages ?? []);
        if (!activeStage || activeStage.tahap !== 5 || activeStage.role_petugas !== "lurah" || !["Menunggu", "Diproses"].includes(String(activeStage.status))) return jsonError("Pengajuan belum berada pada tahap review Lurah.", 409);
        if ((stages ?? []).filter((stage: AnyRow) => stage.tahap < 5).some((stage: AnyRow) => stage.status !== "Disetujui")) return jsonError("Seluruh tahap verifikasi sebelumnya wajib selesai.", 422);
        if (!body.catatan?.trim() && body.action !== "approve") return jsonError("Catatan keputusan wajib diisi.", 422);

        if (body.action !== "approve") {
            const nextStatus = body.action === "reject" ? "DITOLAK" : "REVISI";
            await supabase.from("verifikasi_pengajuan").update({ status: "Ditolak", petugas_id: session.profile.id, catatan: body.catatan, acted_at: now }).eq("id", activeStage.id).in("status", ["Menunggu", "Diproses"]);
            await supabase.from("pengajuan_surat").update({ status: nextStatus, updated_at: now }).eq("id", id);
            await writeAudit(supabase, { pengajuan_id: id, status: nextStatus, action: body.action === "reject" ? "TOLAK" : "KEMBALIKAN", aksi: body.action === "reject" ? "TOLAK" : "KEMBALIKAN", tahap: "LURAH", role: "lurah", user_id: session.profile.id, nama_petugas: session.profile.nama_lengkap, catatan: body.catatan, created_at: now });
            return NextResponse.json({ ok: true, data: { id, status: nextStatus } });
        }

        logFinalize("START", id);
        logFinalizeStep("LOAD_SERVICE");
        const layanan = Array.isArray(pengajuan.layanan) ? pengajuan.layanan[0] : pengajuan.layanan;
        if (!layanan?.id || layanan.aktif === false) return jsonError("Pelayanan tidak valid atau tidak aktif.", 422);
        logFinalizeStep("LOAD_TEMPLATE");
        const template = await getActiveServiceTemplate(supabase, layanan.id);
        if (!template) return jsonError("TEMPLATE BELUM TERSEDIA: naskah resmi pelayanan ini belum terdaftar dan dokumen tidak dapat diterbitkan.", 422);
        if (activeReady) return jsonError("Dokumen final/aktif sudah tersedia.", 409);
        if (!activeDraft) {
            logFinalizeStep("CREATE_DRAFT");
            const version = letterDocs.length + 1;
            const path = `surat-hasil-pelayanan/${id}/v${version}-${Date.now()}-surat-hasil-pelayanan.pdf`;
            assertTemplateContentSafe(template.body, template.fieldSchema ?? []);
            const snapshot = templateSnapshot(template);
            const { error: snapshotError } = await supabase.from("pengajuan_surat").update({
                template_id: template.templateId,
                template_version: template.version,
                template_snapshot: snapshot,
            }).eq("id", id).eq("document_locked", false);
            if (snapshotError) return jsonError(snapshotError.message, 500);
            logLetterStorage("draft_pdf", path);
            const { data: uploaded, error: uploadError } = await supabase.storage.from(LETTER_STORAGE_BUCKET).upload(path, buildPdf(pengajuan, template, version), { contentType: "application/pdf", upsert: false });
            if (uploadError) {
                logLetterStorageError("draft_pdf", path, uploadError);
                return jsonError(`DRAFT PDF upload gagal: ${uploadError.message}`, 500);
            }
            const { data: createdDraft, error: insertError } = await supabase.from("dokumen_pengajuan").insert({
                pengajuan_id: id,
                nama_file: "surat-hasil-pelayanan.pdf",
                jenis: `Surat Hasil Pelayanan v${version}`,
                url_file: uploaded.path,
                status: "DRAFT",
                metadata: { version, active: true, template_id: template.templateId, template_version: template.version, generated_at: now, generated_by: session.profile.id },
            }).select("*").single();
            if (insertError || !createdDraft) return jsonError(insertError?.message ?? "Draft resmi gagal disimpan.", 500);
            activeDraft = createdDraft;
            pengajuan.template_snapshot = snapshot;
        }
        if (activeDraft.metadata?.template_id !== template.templateId || activeDraft.metadata?.template_version !== template.version) return jsonError("Draft tidak berasal dari versi template resmi yang aktif.", 422);
        const supportingDocs = (existingDocs ?? []).filter((d: AnyRow) => !/surat hasil pelayanan/i.test(`${d.jenis ?? ""} ${d.nama_file ?? ""}`));
        if (!supportingDocs.length && !pengajuan.file_pendukung) return jsonError("Dokumen persyaratan belum lengkap.", 422);

        const snapshot = templateFromSnapshot(pengajuan.template_snapshot);
        if (!snapshot || snapshot.templateId !== template.templateId || snapshot.version !== template.version) return jsonError("Snapshot template READY pada pengajuan tidak valid.", 422);
        assertTemplateContentSafe(snapshot.body, snapshot.fieldSchema ?? []);
        logFinalizeStep("LOAD_PROFILE");
        const { data: wargaProfile, error: wargaError } = await supabase.from("warga_profiles")
            .select("nik,nomor_kk,nama_lengkap,tempat_lahir,tanggal_lahir,jenis_kelamin,agama,status_perkawinan,status_pekerjaan,alamat,rt,rw,kelurahan,kecamatan,status_verifikasi,tahap_verifikasi")
            .eq("nik", pengajuan.nik)
            .eq("status_verifikasi", "Terverifikasi")
            .maybeSingle();
        if (wargaError) {
            console.error("Finalisasi gagal membaca profil warga:", { code: wargaError.code ?? null, name: wargaError.name ?? null });
            return jsonError("Profil warga gagal dibaca. Silakan coba lagi nanti.", 500);
        }
        if (!wargaProfile) return jsonError("Profil legal warga terverifikasi tidak ditemukan.", 422);
        const profileLegalIdentity = {
            nik: wargaProfile.nik,
            nomor_kk: wargaProfile.nomor_kk,
            nama_lengkap: wargaProfile.nama_lengkap,
            tempat_lahir: wargaProfile.tempat_lahir,
            tanggal_lahir: wargaProfile.tanggal_lahir,
            jenis_kelamin: wargaProfile.jenis_kelamin,
            agama: wargaProfile.agama,
            status_perkawinan: wargaProfile.status_perkawinan,
            status_pekerjaan: wargaProfile.status_pekerjaan,
            alamat: wargaProfile.alamat,
            rt: wargaProfile.rt,
            rw: wargaProfile.rw,
            kelurahan: wargaProfile.kelurahan,
            kecamatan: wargaProfile.kecamatan,
        };
        const requiredProfileFields: Array<[keyof typeof profileLegalIdentity, string]> = [
            ["agama", "Data agama pada profil warga belum tersedia."],
            ["status_perkawinan", "Data status perkawinan pada profil warga belum tersedia."],
            ["status_pekerjaan", "Data status pekerjaan pada profil warga belum tersedia."],
        ];
        for (const [field, message] of requiredProfileFields) {
            if (typeof wargaProfile[field] !== "string" || !wargaProfile[field].trim()) return jsonError(message, 422);
        }
        if (Object.values(profileLegalIdentity).some((value) => value == null || String(value).trim() === "")) {
            return jsonError("Identitas legal pada profil warga terverifikasi belum lengkap.", 422);
        }
        const submissionIdentity = {
            keperluan: pengajuan.keperluan ?? pengajuan.additional_data?.keperluan,
        };
        const resolvedTemplateData = {
            ...(pengajuan.additional_data ?? {}),
            ...profileLegalIdentity,
            ...submissionIdentity,
            alamat_asal: wargaProfile.alamat,
            alamat_sekarang: wargaProfile.alamat,
        };
        logFinalizeStep("VALIDATE_TEMPLATE");
        const validatedTemplateData = validateTemplateFields(snapshot.fieldSchema ?? [], resolvedTemplateData);
        const validatedAdditionalData = {
            ...(pengajuan.additional_data ?? {}),
            ...Object.fromEntries(
                Object.entries(validatedTemplateData).filter(([key]) => key !== "alamat_asal" && key !== "alamat_sekarang"),
            ),
        };
        let signer;
        const signerProfile = internal?.signerProfile ?? session.profile;
        try { signer = signerFromProfile(signerProfile); } catch (error) { return jsonError(error instanceof Error ? error.message : "Data Lurah tidak valid.", 422); }
        const token = randomUUID();
        const code = verificationCode(token);
        const site = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;
        const verificationUrl = `${site}/verifikasi/${code}`;
        let documentNumber = String(pengajuan.nomor_surat ?? "").trim();
        if (!documentNumber) {
            logFinalizeStep("CLAIM_NUMBER");
            const { data: allocated, error: numberError } = await supabase.rpc("claim_official_letter_finalization", {
                p_pengajuan_id: id,
                p_service_id: layanan.id,
                p_year: new Date().getFullYear(),
            });
            if (numberError || !allocated) return jsonError(`Finalisasi sudah diklaim atau nomor resmi gagal dialokasikan: ${numberError?.message ?? "konfigurasi belum tersedia"}`, numberError?.code === "P0001" ? 409 : 422);
            documentNumber = String(allocated).trim();
        } else {
            const alreadyFinal = pengajuan.document_locked === true || Boolean(pengajuan.issued_at) || Boolean(pengajuan.signed_at);
            if (alreadyFinal) return jsonError("Dokumen sudah pernah difinalisasi.", 409);
        }
        const qrPath = `verification/${id}/${token}.png`;
        const qrBuffer = await QRCode.toBuffer(verificationUrl, { errorCorrectionLevel: "M", margin: 4, width: 768 });
        logFinalize("QR", id);
        logLetterStorage("qr", qrPath);
        const { error: qrError } = await supabase.storage.from(LETTER_STORAGE_BUCKET).upload(qrPath, qrBuffer, { contentType: "image/png", upsert: false });
        if (qrError) {
            logLetterStorageError("qr", qrPath, qrError);
            logFinalize("ERROR", id, { step: "QR_UPLOAD" });
            return jsonError(`QR upload gagal: ${qrError.message}`, 500);
        }
        const version = Number(activeDraft.metadata?.version) || 1;
        const pdfPath = `surat-hasil-pelayanan/${id}/v${version}-${token}-final.pdf`;
        const finalValues = { ...pengajuan, ...profileLegalIdentity, ...submissionIdentity, additional_data: validatedAdditionalData, nomor_surat: documentNumber, tanggal_surat: now.slice(0, 10), verification_code: code, lurah_name: signer.nama, signer_nip: signer.nip, signer_jabatan: signer.jabatan };
        const qrDataUrl = await QRCode.toDataURL(verificationUrl, { errorCorrectionLevel: "M", margin: 4, width: 768 });
        const finalPdf = renderOfficialLetterPdf(finalValues, wargaProfile, qrDataUrl, verificationUrl, String(layanan.nama ?? template.title), snapshot);
        logFinalize("PDF RENDER", id);
        logLetterStorage("final_pdf", pdfPath);
        const { data: finalUpload, error: finalUploadError } = await supabase.storage.from(LETTER_STORAGE_BUCKET).upload(pdfPath, finalPdf, { contentType: "application/pdf", upsert: false });
        if (finalUploadError || !finalUpload) {
            await supabase.storage.from(LETTER_STORAGE_BUCKET).remove([qrPath]);
            logFinalize("ERROR", id, { step: "PDF_UPLOAD" });
            if (finalUploadError) logLetterStorageError("final_pdf", pdfPath, finalUploadError);
            return jsonError(`PDF final upload gagal: ${finalUploadError?.message ?? "Object path tidak tersedia."}`, 500);
        }
        const issuedMetadata = { ...(activeDraft.metadata ?? {}), active: true, locked: true, signer, signed_at: now, issued_at: now, verification_token: token, verification_code: code, verification_url: verificationUrl, qr_path: qrPath, pdf_path: finalUpload.path, approval_type: "INTERNAL_DIGITAL_APPROVAL" };
        const { data: issuedDocument, error: documentError } = await supabase.from("dokumen_pengajuan").update({ status: "TERBIT", url_file: finalUpload.path, metadata: issuedMetadata }).eq("id", activeDraft.id).eq("pengajuan_id", id).select("id,url_file,status").maybeSingle();
        if (documentError || !issuedDocument) {
            await supabase.storage.from(LETTER_STORAGE_BUCKET).remove([qrPath, finalUpload.path]);
            logFinalize("ERROR", id, { step: "DOCUMENT" });
            return jsonError(documentError?.message ?? "Dokumen hasil gagal diterbitkan.", 500);
        }
        logFinalize("PDF UPLOAD", id);
        logFinalize("DOCUMENT", id, { documentId: issuedDocument.id });
        const update = {
            ...profileLegalIdentity,
            keperluan: submissionIdentity.keperluan,
            additional_data: validatedAdditionalData,
            status: "Selesai", nomor_surat: documentNumber,
            tanggal_surat: now.slice(0, 10), verification_token: token, verification_code: code,
            verification_url: verificationUrl, final_pdf_url: finalUpload.path, qr_path: qrPath,
            lurah_id: signerProfile.id, lurah_name: signer.nama, signer_nip: signer.nip,
            signer_jabatan: signer.jabatan, validated_by: session.profile.id, validated_at: now,
            signed_at: now, issued_at: now, document_locked: true, selesai_at: now, selesai_by: session.profile.id, updated_at: now,
        };
        const { data: finalized, error: finalizeError } = await supabase.from("pengajuan_surat").update(update).eq("id", id).eq("nomor_surat", documentNumber).eq("document_locked", false).is("issued_at", null).select("*").maybeSingle();
        if (finalizeError || !finalized) {
            logFinalize("ERROR", id, { step: "SUBMISSION" });
            await supabase.from("dokumen_pengajuan").update({ status: activeDraft.status, url_file: activeDraft.url_file, metadata: activeDraft.metadata ?? {} }).eq("id", activeDraft.id).eq("status", "TERBIT");
            logLetterStorage("cleanup_qr", qrPath);
            const { error: cleanupError } = await supabase.storage.from(LETTER_STORAGE_BUCKET).remove([qrPath, finalUpload.path]);
            if (cleanupError) {
                logLetterStorageError("cleanup_qr", qrPath, cleanupError);
                return jsonError(`Cleanup QR gagal: ${cleanupError.message}. Finalisasi database juga gagal: ${finalizeError?.message ?? "Dokumen telah berubah atau sudah diterbitkan."}`, 500);
            }
            return jsonError(finalizeError?.message ?? "Dokumen telah berubah atau sudah diterbitkan.", 409);
        }
        logFinalize("SUBMISSION", id);
        await supabase.from("verifikasi_pengajuan").update({ status: "Disetujui", petugas_id: session.profile.id, catatan: body.catatan || "Disetujui dan ditandatangani secara digital internal oleh Lurah.", acted_at: now, approved_at: now }).eq("id", activeStage.id).in("status", ["Menunggu", "Diproses"]);
        await supabase.from("tracking_pengajuan").insert({ pengajuan_id: id, status: "SELESAI", keterangan: "Dokumen disetujui Lurah, diberi QR verifikasi, dan diterbitkan.", petugas: signer.nama, created_at: now });
        for (const action of ["REVIEW_LURAH", "APPROVAL_LURAH", "TTD", "PENERBITAN", "QR_CREATED", "PDF_CREATED"]) await writeAudit(supabase, { pengajuan_id: id, status: "SELESAI", action, aksi: action, tahap: "LURAH", role: "lurah", user_id: session.profile.id, nama_petugas: signer.nama, catatan: action === "TTD" ? "Persetujuan digital internal; bukan TTE bersertifikat BSrE." : body.catatan || "Dokumen final diterbitkan.", metadata: { verification_code: code, verification_url: verificationUrl, qr_path: qrPath, pdf_path: finalUpload.path }, created_at: now });
        await sendApplicationStatusEmailSafely(statusEmailInputFromSubmission({ ...pengajuan, ...finalized }, "completed", body.catatan, now));
        logFinalize("SUCCESS", id, { documentId: issuedDocument.id });
        return NextResponse.json({
            ok: true,
            message: "Surat berhasil difinalisasi.",
            document_id: issuedDocument.id,
            pengajuan_id: id,
            status: "Selesai",
            data: { ...finalized, id: issuedDocument.id, document_id: issuedDocument.id, pengajuan_id: id, status: "Selesai", verification_url: verificationUrl, verification_code: code, pdf_path: finalUpload.path, qr_path: qrPath },
        });

    }

    if (workflowRole !== "staff_pelayanan") return jsonError("Hanya Staff Pelayanan yang dapat membuat surat untuk TTD Lurah.", 403);
    if (body.action === "confirm") {
        if (!activeDraft) return jsonError("Draft surat belum tersedia.");
        const { data: updatedDraft, error: updateError } = await supabase.from("dokumen_pengajuan").update({ status: "SIAP_DIVERIFIKASI", metadata: { ...(activeDraft.metadata ?? {}), confirmed_at: now, confirmed_by: session.profile.id } }).eq("id", activeDraft.id).select("*").single();
        if (updateError) return jsonError(updateError.message, 500);
        await writeAudit(supabase, { pengajuan_id: id, status: "SIAP_DIVERIFIKASI", catatan: "Draft surat hasil pelayanan diteruskan untuk verifikasi berjenjang.", created_at: now });
        return NextResponse.json({ ok: true, data: updatedDraft });
    }

    if (activeDraft || activeReady) return jsonError("Surat aktif sudah tersedia. Tidak dapat membuat surat ganda.", 409);
    const { data: pengajuan, error: pengajuanError } = await supabase.from("pengajuan_surat").select("*, layanan(*)").eq("id", id).maybeSingle();
    if (pengajuanError) return jsonError(pengajuanError.message, 500);
    if (!pengajuan) return jsonError("Pengajuan tidak ditemukan.", 404);
    const layanan = Array.isArray(pengajuan.layanan) ? pengajuan.layanan[0] : pengajuan.layanan;
    const template = await getActiveServiceTemplate(supabase, layanan?.id);
    if (!template) return jsonError("TEMPLATE BELUM TERSEDIA: draft generik tidak dibuat untuk mencegah isi surat palsu.", 422);
    if (!pickName(pengajuan) || !pickLayanan(pengajuan)) return jsonError("Data belum lengkap untuk membuat draft surat.", 422);
    const version = letterDocs.length + 1;
    const path = `surat-hasil-pelayanan/${id}/v${version}-${Date.now()}-surat-hasil-pelayanan.pdf`;
    assertTemplateContentSafe(template.body, template.fieldSchema ?? []);
    const snapshot = templateSnapshot(template);
    const { error: snapshotError } = await supabase.from("pengajuan_surat").update({ template_id: template.templateId, template_version: template.version, template_snapshot: snapshot }).eq("id", id).eq("document_locked", false);
    if (snapshotError) return jsonError(snapshotError.message, 500);
    logLetterStorage("draft_pdf", path);
    const { data: uploaded, error: uploadError } = await supabase.storage.from(LETTER_STORAGE_BUCKET).upload(path, buildPdf(pengajuan, template, version), { contentType: "application/pdf", upsert: false });
    if (uploadError) {
        logLetterStorageError("draft_pdf", path, uploadError);
        return jsonError(`DRAFT PDF upload gagal: ${uploadError.message}`, 500);
    }

    const { data: doc, error: insertError } = await supabase.from("dokumen_pengajuan").insert({ pengajuan_id: id, nama_file: "surat-hasil-pelayanan.pdf", jenis: `Surat Hasil Pelayanan v${version}`, url_file: uploaded.path, status: "DRAFT", metadata: { version, active: true, template_id: template.templateId, template_version: template.version, generated_at: now, generated_by: session.profile.id } }).select("*").single();
    if (insertError) return jsonError(insertError.message, 500);

    await writeAudit(supabase, { pengajuan_id: id, status: "DRAFT", catatan: `Draft surat hasil pelayanan versi ${version} dibuat otomatis.`, created_at: now });
    logLetterStorage("signed_url", uploaded.path);
    const { data: signed, error: signedUrlError } = await supabase.storage.from(LETTER_STORAGE_BUCKET).createSignedUrl(uploaded.path, 60 * 10);
    if (signedUrlError) {
        logLetterStorageError("signed_url", uploaded.path, signedUrlError);
        return jsonError(`Signed URL gagal: ${signedUrlError.message}`, 500);
    }
    return NextResponse.json({ ok: true, data: { ...doc, file_url: signed?.signedUrl ?? "", signed_url: signed?.signedUrl ?? "", version } });
}