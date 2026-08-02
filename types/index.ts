export type ServiceCategory = "administrasi" | "pengaduan" | "posbankum";

export type PublicService = {
    id: string;
    title: string;
    category: ServiceCategory;
    description: string;
    requirements: string[];
    duration: string;
    online: boolean;
};

export type NewsItem = {
    id: string;
    title: string;
    category: string;
    excerpt: string;
    date: string;
    image: string;
};

export type AgendaItem = { id: string; title: string; date: string; location: string; reminder: boolean };
export type GalleryItem = { id: string; title: string; type: "photo" | "video"; src: string };
export type Statistic = { label: string; value: number; suffix?: string };

export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string };