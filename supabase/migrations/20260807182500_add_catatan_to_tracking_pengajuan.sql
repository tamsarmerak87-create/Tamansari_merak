alter table public.tracking_pengajuan
add column if not exists catatan text;

comment on column public.tracking_pengajuan.catatan is 'Catatan riwayat aktivitas pengajuan. Disinkronkan dengan keterangan untuk kompatibilitas modul tracking lama dan baru.';