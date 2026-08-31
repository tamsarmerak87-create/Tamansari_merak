export const MAX_WARGA_FILE_SIZE = 1024 * 1024;
const DIMENSIONS = [1600, 1400, 1200, 1000, 900, 800];
const QUALITIES = [0.82, 0.75, 0.68, 0.60, 0.52, 0.44, 0.36, 0.30];
const IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

function imageName(name: string) {
    return name.replace(/\.[^.]+$/, "") + ".jpg";
}

async function compressImage(file: File): Promise<File> {
    if (typeof document === "undefined") throw new Error("File tidak dapat diproses. Silakan coba foto atau file lain.");
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(async () => {
        const url = URL.createObjectURL(file);
        try {
            const image = new Image();
            image.src = url;
            await image.decode();
            return image;
        } finally { URL.revokeObjectURL(url); }
    });
    const sourceWidth = bitmap.width;
    const sourceHeight = bitmap.height;
    try {
        for (const maxDimension of DIMENSIONS) {
            const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(sourceWidth * scale));
            canvas.height = Math.max(1, Math.round(sourceHeight * scale));
            const context = canvas.getContext("2d");
            if (!context) throw new Error("canvas unavailable");
            context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            for (const quality of QUALITIES) {
                const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
                if (blob && blob.size <= MAX_WARGA_FILE_SIZE) {
                    const result = new File([blob], imageName(file.name), { type: "image/jpeg", lastModified: file.lastModified });
                    if (process.env.NODE_ENV !== "production") console.debug("[WARGA FILE COMPRESS]", { name: file.name, originalSize: file.size, compressedSize: result.size, mimeType: result.type });
                    return result;
                }
            }
            canvas.width = 1;
            canvas.height = 1;
        }
    } finally {
        if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();
    }
    throw new Error("Ukuran file masih lebih dari 1 MB. Silakan pilih file lain.");
}

export async function compressWargaFile(file: File): Promise<File> {
    if (!file || file.size === 0) throw new Error("File kosong.");
    if (file.size <= MAX_WARGA_FILE_SIZE) return file;
    if (IMAGE_TYPES.has(file.type)) {
        try { return await compressImage(file); }
        catch (error) { if (error instanceof Error && error.message.includes("lebih dari 1 MB")) throw error; throw new Error("File tidak dapat dikompres. Silakan coba foto atau file lain."); }
    }
    throw new Error("Ukuran file masih lebih dari 1 MB. Silakan pilih file lain.");
}