import { agenda, gallery, news, statistics } from "@/constants/site";
import type { AdminProfile, AgendaItem, BannerRecord, ComplaintRecord, EmployeeRecord, FaqRecord, LetterRecord, NewsItem, PosbankumRecord, PublicService, Statistic } from "@/types";
import { createSupabaseBrowserClient, createSupabaseServerClient, subscribeToTable } from "@/services/supabase";

type TableName = "admin_profiles" | "employees" | "news" | "agenda" | "banners" | "faqs" | "letters" | "complaints" | "posbankum_cases" | "statistics";
type RepositoryPayload = Record<string, unknown>;

type LayananRow = {
    id: string;
    nama: string;
    deskripsi: string | null;
    aktif: boolean;

    persyaratan: string[] | null;
    alur: string[] | null;
    dasar_hukum: string | null;
    output: string | null;
    kanal: string | null;
};

function mapLayananRow(row: LayananRow): PublicService {
    return {
        id: row.id,
        title: row.nama,
        category: "administrasi",
        description: row.deskripsi ?? "",
        requirements: row.persyaratan ?? [],
        flow: row.alur ?? [],
        legalBasis: row.dasar_hukum ?? "",
        output: row.output ?? "",
        channel: row.kanal ?? "",
        online: row.aktif,
    };
}

function getClient() {
    return createSupabaseServerClient() ?? createSupabaseBrowserClient();
}

export function createRepository<T extends { id: string }>(table: TableName) {
    return {
        async list(fallback: T[] = []) {
            const client = getClient();
            if (!client) return fallback;
            const { data, error } = await client.from(table).select("*").order("created_at", { ascending: false });
            if (error) return fallback;
            return (data ?? fallback) as T[];
        },
        async getById(id: string) {
            const client = getClient();
            if (!client) return null;
            const { data, error } = await client.from(table).select("*").eq("id", id).maybeSingle();
            if (error) return null;
            return data as T | null;
        },
        async create(payload: Omit<T, "id">) {
            const client = getClient();
            if (!client) throw new Error("Supabase env belum dikonfigurasi.");
            const { data, error } = await client.from(table).insert(payload as RepositoryPayload).select("*").single();
            if (error) throw error;
            return data as T;
        },
        async update(id: string, payload: Partial<T>) {
            const client = getClient();
            if (!client) throw new Error("Supabase env belum dikonfigurasi.");
            const { data, error } = await client.from(table).update(payload as RepositoryPayload).eq("id", id).select("*").single();
            if (error) throw error;
            return data as T;
        },
        async remove(id: string) {
            const client = getClient();
            if (!client) throw new Error("Supabase env belum dikonfigurasi.");
            const { error } = await client.from(table).delete().eq("id", id);
            if (error) throw error;
            return true;
        },
        subscribe(onChange: () => void) {
            return subscribeToTable(table, onChange);
        },
    };
}

export const publicRepository = {
    getStatistics: async () => createRepository<Statistic & { id: string }>("statistics").list(statistics.map((item) => ({ id: item.label, ...item }))),
    getServices: async () => {
        const client = getClient();
        if (!client) return [] as PublicService[];

        const { data, error } = await client
            .from("layanan")
            .select("*")
            .eq("aktif", true)
            .order("nama", { ascending: true });

        if (error) {
            console.error("Supabase layanan error:", error);
            throw error;
        }

        return ((data ?? []) as LayananRow[]).map(mapLayananRow);
    },
    getNews: async () => createRepository<NewsItem>("news").list(news),
    getAgenda: async () => createRepository<AgendaItem>("agenda").list(agenda),
    getGallery: async () => gallery,
};

export const adminRepository = {
    profiles: createRepository<AdminProfile>("admin_profiles"),
    employees: createRepository<EmployeeRecord>("employees"),
    news: createRepository<NewsItem>("news"),
    agenda: createRepository<AgendaItem>("agenda"),
    banners: createRepository<BannerRecord>("banners"),
    faqs: createRepository<FaqRecord>("faqs"),
    letters: createRepository<LetterRecord>("letters"),
    complaints: createRepository<ComplaintRecord>("complaints"),
    posbankum: createRepository<PosbankumRecord>("posbankum_cases"),
};