export type ServiceCategory = "administrasi" | "pengaduan" | "posbankum";

export type PublicService = {
    id: string;
    title: string;
    category: ServiceCategory;
    description: string;
    requirements: string[];
    online: boolean;
    legalBasis?: string;
    flow?: string[];
    output?: string;
    channel?: string;
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

export type UserRole = "super_admin" | "admin" | "editor" | "viewer";

export type DatabaseRecord = {
    id: string;
    created_at?: string;
    updated_at?: string;
};

export type AdminProfile = DatabaseRecord & {
    user_id: string;
    full_name: string;
    role: UserRole;
    is_active: boolean;
};

export type EmployeeRecord = DatabaseRecord & { name: string; position: string; email?: string; status: string };
export type BannerRecord = DatabaseRecord & { title: string; image_url: string; is_active: boolean; sort_order: number };
export type FaqRecord = DatabaseRecord & { question: string; answer: string; category: string; is_active: boolean };
export type LetterRecord = DatabaseRecord & { applicant_name: string; type: string; status: string; file_url?: string };
export type ComplaintRecord = DatabaseRecord & { reporter_name: string; title: string; status: string; message: string };
export type PosbankumRecord = DatabaseRecord & { applicant_name: string; case_type: string; status: string; schedule?: string };