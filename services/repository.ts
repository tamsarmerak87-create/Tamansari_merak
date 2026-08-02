import { agenda, gallery, news, services, statistics } from "@/constants/site";

export const publicRepository = {
    getStatistics: async () => statistics,
    getServices: async () => services,
    getNews: async () => news,
    getAgenda: async () => agenda,
    getGallery: async () => gallery,
};