import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const session = read("services/admin-session.ts");
const middleware = read("middleware.ts");
const shell = read("components/admin/admin-shell.tsx");
const adminData = read("app/api/admin/data/route.ts");
const verificationApi = read("app/api/petugas/verifikasi-warga/route.ts");
const verificationWorkflow = read("services/warga-verification-workflow.ts");
const penggunaApi = read("app/api/admin/pengguna/route.ts");
const penggunaDetailApi = read("app/api/admin/pengguna/[id]/route.ts");

const adminPages = [
    "app/admin/page.tsx",
    "app/admin/verifikasi-warga/page.tsx",
    "app/admin/pengguna/page.tsx",
    "app/admin/pengajuan/page.tsx",
    "app/admin/tracking/page.tsx",
    "app/admin/posbankum/page.tsx",
    "app/admin/berita/page.tsx",
    "app/admin/petugas/page.tsx",
    "app/admin/laporan/page.tsx",
    "app/admin/pengaturan/page.tsx",
];

test("seluruh halaman Portal Admin yang diwajibkan tersedia", () => {
    for (const path of adminPages) {
        assert.equal(existsSync(new URL(`../${path}`, import.meta.url)), true, `${path} harus tersedia`);
    }
});

test("sidebar ADMIN menampilkan seluruh modul termasuk Verifikasi Warga", () => {
    for (const label of ["Dashboard", "Master Layanan", "Verifikasi Warga", "Pengajuan", "Tracking", "POSBANKUM", "Berita", "Petugas", "Pengguna", "Laporan", "Pengaturan"]) {
        assert.match(shell, new RegExp(label, "i"));
    }
    assert.match(shell, /["']Verifikasi Warga["']\s*,\s*["']\/admin\/verifikasi-warga["']\s*,/);
});

test("helper terpusat memberi ADMIN akses admin, verifikasi, dan pengguna", () => {
    assert.match(session, /function canAccessAdmin[\s\S]*?return isAdmin\(user\)/);
    assert.match(session, /function canAccessVerification[\s\S]*?return isAdmin\(user\)/);
    assert.match(session, /function canManageUsers[\s\S]*?return isAdmin\(user\)/);
    assert.match(session, /function isAdminRole[\s\S]*?["']admin["']/i);
});

test("route admin tetap dilindungi session server-side", () => {
    assert.match(middleware, /admin_session/);
    assert.match(adminData, /getAdminSession\(request/);
    assert.match(adminData, /requireAdmin\(session\.profile\)/);
    assert.match(adminData, /getAdminSession\(request, \{ cookie: ["']admin["'] \}\)/);
    assert.match(adminData, /session\.error \|\| !session\.profile[\s\S]*?401/);
    assert.match(adminData, /requireAdmin\(session\.profile\)[\s\S]*?403/);
    assert.doesNotMatch(adminData, /cookie:\s*["']any["']/);
    assert.doesNotMatch(adminData, /isPetugas\(session\.profile\)/);
    assert.match(adminData, /\.from\(["']pengajuan_surat["']\)/);
    assert.doesNotMatch(adminData, /body\.(role|user_id).*?(authorize|access|admin)/i);
});

test("ADMIN dapat membaca antrean dan detail verifikasi warga", () => {
    assert.match(verificationApi, /getAdminSession\(request, \{ cookie: ["']any["'] \}\)/);
    assert.match(verificationApi, /isAdmin\(session\.profile\).*isPetugas\(session\.profile\)/);
    assert.match(verificationApi, /searchParams\.get\(["']id["']\)/);
    assert.match(verificationApi, /enrichWargaDetail/);
    assert.match(adminData, /\.eq\(["']status_verifikasi["'], ["']Belum Terverifikasi["']\)/);
});

test("ADMIN dapat menyetujui dan menolak warga menggunakan status existing", () => {
    assert.match(verificationWorkflow, /isAdminRole\(user\.role\)/);
    assert.match(verificationWorkflow, /stage\.role === ["']lurah["'] \|\| isAdminRole\(params\.petugas\.role\)/);
    assert.match(verificationWorkflow, /params\.action === ["']tolak["']/);
    for (const status of ["Belum Terverifikasi", "Terverifikasi", "Ditolak"]) {
        assert.match(verificationWorkflow, new RegExp(status));
    }
});

test("warga biasa, role tidak berhak, dan request tanpa session tetap ditolak", () => {
    assert.match(verificationApi, /session\.error \|\| !session\.profile[\s\S]*?401/);
    assert.match(verificationApi, /!isAdmin\(session\.profile\) && !isPetugas\(session\.profile\)[\s\S]*?403/);
    assert.doesNotMatch(verificationApi, /request\.json\(\)[\s\S]*?body\.(role|user_id)[\s\S]*?isAdmin/i);
});

test("manajemen pengguna dilindungi session ADMIN dan tidak percaya role dari body", () => {
    for (const source of [penggunaApi, penggunaDetailApi]) {
        assert.match(source, /getAdminSession\(request, \{ cookie: ["']admin["'] \}\)/);
        assert.match(source, /canManageUsers\(session\.profile\)/);
        assert.doesNotMatch(source, /body\.(role|user_id).*?(authorize|access|admin)/i);
    }
    assert.match(penggunaDetailApi, /export async function PATCH/);
    assert.match(penggunaDetailApi, /auth\.admin\.updateUserById/);
    assert.match(penggunaDetailApi, /export async function DELETE/);
    assert.match(penggunaDetailApi, /auth\.admin\.deleteUser/);
});

test("UI pengguna menyediakan tabel, edit, hapus, refresh, dan notifikasi", () => {
    assert.match(shell, /function Pengguna/);
    for (const text of ["Daftar akun warga", "Refresh", "Edit Pengguna", "Hapus pengguna?", "Data pengguna berhasil diperbarui", "Akun dan data pengguna berhasil dihapus"]) {
        assert.match(shell, new RegExp(text.replace(/[?]/g, "\\?")));
    }
    assert.match(shell, /fetch\(`\/api\/admin\/pengguna\/\$\{editing\.id\}`/);
    assert.match(shell, /method: ["']PATCH["']/);
    assert.match(shell, /method: ["']DELETE["']/);
});

test("Edit Pengguna mengelola agama dari warga_profiles", () => {
    assert.match(shell, /key: "agama", label: "Agama"/);
    assert.match(shell, /key === "agama"/);
    assert.match(shell, /Pilih Agama/);
    assert.match(shell, /WARGA_RELIGIONS/);
    assert.match(shell, /<option key=\{option\} value=\{option\}>\{option\}<\/option>/);
    assert.match(shell, /createWargaProfileForm\(editing\)/);
    assert.match(shell, /await refreshUsers\(\)/);
    assert.match(penggunaDetailApi, /"agama"/);
    assert.match(penggunaDetailApi, /isWargaReligion\(updates\.agama\)/);
    assert.match(penggunaDetailApi, /from\("warga_profiles"\)[\s\S]*?\.update\(updates\)/);
});
