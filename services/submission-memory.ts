export const SUBMISSION_DRAFT_VERSION = 1;
export const SUBMISSION_DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SUBMISSION_DRAFT_PREFIX = "tamansari:submission-draft";

export type SubmissionDraft<T> = {
    version: 1;
    savedAt: string;
    expiresAt: string;
    currentStep: number;
    data: T;
    documents: Array<{ jenis: string; wajib: boolean; nama_file?: string; ukuran?: number; status: "PERLU_UPLOAD_ULANG" }>;
};

export function submissionDraftKey(userId: string, serviceId: string) {
    return `${SUBMISSION_DRAFT_PREFIX}:${userId}:${serviceId}`;
}

export function createSubmissionDraft<T>(currentStep: number, data: T, documents: SubmissionDraft<T>["documents"], now = new Date()): SubmissionDraft<T> {
    return { version: SUBMISSION_DRAFT_VERSION, savedAt: now.toISOString(), expiresAt: new Date(now.getTime() + SUBMISSION_DRAFT_TTL_MS).toISOString(), currentStep: Math.min(8, Math.max(1, Math.trunc(currentStep))), data, documents };
}

export function readSubmissionDraft<T>(storage: Pick<Storage, "getItem" | "removeItem">, key: string, now = new Date()): SubmissionDraft<T> | null {
    try {
        const raw = storage.getItem(key);
        if (!raw) return null;
        const value = JSON.parse(raw) as Partial<SubmissionDraft<T>>;
        if (value.version !== SUBMISSION_DRAFT_VERSION || !value.data || !value.savedAt || !value.expiresAt || !Number.isInteger(value.currentStep)) throw new Error("invalid draft");
        if (Date.parse(value.expiresAt) <= now.getTime()) throw new Error("expired draft");
        return value as SubmissionDraft<T>;
    } catch {
        storage.removeItem(key);
        return null;
    }
}

export function writeSubmissionDraft<T>(storage: Pick<Storage, "setItem">, key: string, draft: SubmissionDraft<T>) {
    const json = JSON.stringify(draft);
    if (json.length > 100_000) throw new Error("Draft hanya menyimpan data isian, bukan file.");
    storage.setItem(key, json);
}