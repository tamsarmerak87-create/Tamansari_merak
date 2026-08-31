export const SUBMISSION_DOCUMENT_BUCKET = "surat";
export const DOCUMENT_UNAVAILABLE_MESSAGE = "Dokumen belum dapat diakses. Silakan hubungi administrator.";

export function normalizeSubmissionObjectPath(pathOrUrl?: string | null) {
    const value = pathOrUrl?.trim();
    if (!value) return "";
    const stripBucket = (path: string) => path.replace(/^\/+/, "").replace(new RegExp(`^${SUBMISSION_DOCUMENT_BUCKET}/`), "");
    if (!/^https?:\/\//i.test(value)) return stripBucket(value);
    try {
        const pathname = new URL(value).pathname;
        for (const prefix of [
            `/storage/v1/object/public/${SUBMISSION_DOCUMENT_BUCKET}/`,
            `/storage/v1/object/sign/${SUBMISSION_DOCUMENT_BUCKET}/`,
            `/storage/v1/object/authenticated/${SUBMISSION_DOCUMENT_BUCKET}/`,
        ]) {
            const index = pathname.indexOf(prefix);
            if (index >= 0) return stripBucket(decodeURIComponent(pathname.slice(index + prefix.length)));
        }
        return "";
    } catch {
        return "";
    }
}

export function logSubmissionStorageError(operation: string, error: unknown) {
    const storageError = error as { code?: string; error?: string; statusCode?: string | number };
    console.error("[SUBMISSION STORAGE ERROR]", {
        operation,
        bucket: SUBMISSION_DOCUMENT_BUCKET,
        code: storageError.code ?? storageError.error ?? storageError.statusCode ?? "UNKNOWN",
    });
}