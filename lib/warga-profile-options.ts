export const WARGA_MARITAL_STATUSES = ["Menikah", "Belum Menikah", "Janda", "Duda"] as const;
export const WARGA_EMPLOYMENT_STATUSES = ["Bekerja", "Belum Bekerja"] as const;
export const WARGA_RELIGIONS = ["Islam", "Kristen", "Katolik", "Hindu", "Buddha", "Konghucu"] as const;

export function normalizeWargaEmploymentStatus(value: unknown) {
    const normalized = String(value ?? "").trim();
    return normalized === "Sudah Bekerja" ? "Bekerja" : normalized;
}

export function isWargaMaritalStatus(value: string): value is (typeof WARGA_MARITAL_STATUSES)[number] {
    return WARGA_MARITAL_STATUSES.includes(value as (typeof WARGA_MARITAL_STATUSES)[number]);
}

export function isWargaEmploymentStatus(value: string): value is (typeof WARGA_EMPLOYMENT_STATUSES)[number] {
    return WARGA_EMPLOYMENT_STATUSES.includes(value as (typeof WARGA_EMPLOYMENT_STATUSES)[number]);
}

export function isWargaReligion(value: string): value is (typeof WARGA_RELIGIONS)[number] {
    return WARGA_RELIGIONS.includes(value as (typeof WARGA_RELIGIONS)[number]);
}