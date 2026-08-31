import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [forgotPage, verifyPage, loginPage, registerPage, registerRoute, authService, authUrl, messages, verificationGuard, dashboardPage] = await Promise.all([
    readFile(new URL("../app/forgot-password/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/verify/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/login/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/register/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/warga/register/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../services/warga-auth.service.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/auth-url.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/messages.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/auth/verification-guard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8"),
]);

function functionBody(source, name, nextExport) {
    const start = source.indexOf(`export async function ${name}`);
    const end = source.indexOf(`export async function ${nextExport}`, start);
    assert.notEqual(start, -1, `${name} tidak ditemukan`);
    return source.slice(start, end === -1 ? source.length : end);
}

test("forgot-password hanya mengirim reset email ke trusted /verify redirect", () => {
    const requestBody = functionBody(authService, "requestPasswordReset", "updateWargaPassword");
    assert.match(forgotPage, /await requestPasswordReset\(email\)/);
    assert.match(requestBody, /auth\.resetPasswordForEmail\([^;]+redirectTo:\s*getAuthRedirectUrl\(\)/s);
    assert.doesNotMatch(forgotPage, /updateWargaPassword|updateUser/);
    assert.doesNotMatch(requestBody, /updateUser/);
    assert.match(forgotPage, /Jika email terdaftar, link reset password akan dikirim ke email Anda\./);
});

test("register memakai signUp email redirect dan memberi instruksi konfirmasi", () => {
    assert.match(registerRoute, /auth\.signUp\(\{[\s\S]*emailRedirectTo:\s*getAuthRedirectUrl\(\)/);
    assert.match(registerPage, /Registrasi berhasil\. Silakan cek email Anda untuk mengaktifkan akun\./);
    assert.match(registerPage, /\/verify\?registered=1&email=/);
    assert.doesNotMatch(registerRoute, /email_confirmed_at\s*:/);
});

test("resend confirmation menggunakan Supabase signup tanpa auto-resend", () => {
    const resendBody = functionBody(authService, "resendSignupConfirmation", "requestPasswordReset");
    assert.match(resendBody, /auth\.resend\(\{ type: "signup", email: email\.trim\(\), options: \{ emailRedirectTo: getAuthRedirectUrl\(\) \} \}\)/);
    assert.match(verifyPage, /Kirim Ulang Email Konfirmasi/);
    assert.match(verifyPage, /resending \? "Mengirim\.\.\."/);
    assert.doesNotMatch(verifyPage, /setInterval|setTimeout\([^)]*resend/);
});

test("login email memetakan kredensial salah dan email belum confirmed", () => {
    assert.match(authService, /auth\.signInWithPassword\(\{ email, password: payload\.password \}\)/);
    assert.match(loginPage, /isEmailConfirmationError\(error\)/);
    assert.match(loginPage, /needsConfirmation \? <Button[\s\S]*Kirim Ulang Email Konfirmasi/);
    assert.match(messages, /Email atau password tidak valid\./);
    assert.match(messages, /Email Anda belum dikonfirmasi\./);
});

test("Google OAuth memakai callback trusted dan disabled error manusiawi", () => {
    const googleBody = functionBody(authService, "signInWithGoogle", "logoutWarga");
    assert.match(googleBody, /signInWithOAuth\(\{ provider: "google", options: \{ redirectTo: getAuthRedirectUrl\(\) \} \}\)/);
    assert.match(googleBody, /isGoogleLoginConfigured\(\)/);
    assert.match(googleBody, /Login dengan Google belum tersedia/);
    assert.match(verifyPage, /app_metadata\?\.provider === "google"[\s\S]*router\.replace\("\/dashboard"\)/);
    assert.doesNotMatch(`${loginPage}\n${authService}`, /GOOGLE_CLIENT_SECRET|client_secret/i);
});

test("redirect auth hanya dibangun dari environment tepercaya ke /verify", () => {
    assert.match(authUrl, /NEXT_PUBLIC_SITE_URL \|\| process\.env\.NEXT_PUBLIC_VERCEL_URL/);
    assert.match(authUrl, /return `\$\{getTrustedSiteUrl\(\)\}\/verify`/);
    assert.doesNotMatch(authUrl, /searchParams|params\.get\(["'](?:redirect|next|returnTo)/);
    assert.doesNotMatch(`${registerRoute}\n${authService}`, /redirectTo:\s*(?:params|searchParams|new URLSearchParams)/);
});

test("updateUser password hanya berada pada service update yang dipanggil submit reset", () => {
    const updateBody = functionBody(authService, "updateWargaPassword", "signInWargaWithGoogle");
    assert.match(updateBody, /auth\.updateUser\(\{ password: nextPassword \}\)/);
    assert.equal((authService.match(/auth\.updateUser\(\{ password:/g) || []).length, 1);
    assert.match(verifyPage, /async function save\(event: FormEvent\)[\s\S]*await updateWargaPassword\(password\)/);
    assert.match(verifyPage, /<form onSubmit=\{save\}/);
});

test("link reset baru menuju forgot-password dan tidak mengaktifkan recovery", () => {
    assert.match(verifyPage, /href="\/forgot-password"[^>]*>Minta Link Reset Baru/);
    assert.doesNotMatch(verifyPage, /Minta Link Reset Baru[\s\S]{0,120}(setView\("recovery"\)|updateWargaPassword)/);
});

test("expired callback menjadi error dan tidak membuka form reset", () => {
    assert.match(verifyPage, /otp_expired\|access_denied\|expired\|invalid/);
    assert.match(verifyPage, /setView\("recovery-error"\)/);
    assert.match(verifyPage, /Link Reset Tidak Dapat Diproses/);
    assert.match(verifyPage, /Link reset password sudah kedaluwarsa atau tidak valid\./);
    assert.match(verifyPage, /Link sudah tidak dapat digunakan\. Silakan minta link reset password baru\./);
});

test("verify tanpa callback menjadi idle, bukan recovery", () => {
    assert.match(verifyPage, /if \(!hasCallback\) \{\s*setView\("idle"\);\s*return;/);
    assert.match(verifyPage, /view === "idle"[\s\S]*title="Verifikasi Email"/);
    assert.match(verifyPage, /Belum ada proses yang sedang diproses\./);
    assert.match(verifyPage, /href="\/login"[^>]*>Kembali ke Portal/);
});

test("PASSWORD_RECOVERY secara eksplisit membuka form reset", () => {
    assert.match(verifyPage, /event === "PASSWORD_RECOVERY"\) setView\("recovery"\)/);
    assert.match(verifyPage, /view === "recovery"[\s\S]*<form onSubmit=\{save\}/);
});

test("confirmation callback tidak dianggap recovery", () => {
    assert.match(verifyPage, /if \(type === "recovery"\) \{ setView\("recovery"\); return; \}/);
    assert.match(verifyPage, /email_confirmed_at[\s\S]*setView\("confirmed"\)/);
    assert.match(verifyPage, /view === "updated"[\s\S]*Email Terkonfirmasi/);
    assert.match(verifyPage, /Email Anda berhasil dikonfirmasi\./);
});

test("email confirmation membaca status petugas tanpa mengubahnya", () => {
    const confirmationStart = verifyPage.indexOf("if (!data.session.user.email_confirmed_at)");
    const confirmationEnd = verifyPage.indexOf('setView("confirmed")', confirmationStart);
    const confirmationFlow = verifyPage.slice(confirmationStart, confirmationEnd);
    assert.match(confirmationFlow, /getCurrentWargaVerificationStatus\(\)/);
    assert.match(confirmationFlow, /setAccountVerified\(isVerified\(profile\)\)/);
    assert.doesNotMatch(confirmationFlow, /\.update\(|updateWargaProfile|status_verifikasi\s*:/);
});

test("akun pending menampilkan informasi menunggu verifikasi petugas", () => {
    assert.match(verifyPage, /data-account-status="pending"/);
    assert.match(verifyPage, /Akun Menunggu Verifikasi Petugas/);
    assert.match(verifyPage, />Menunggu Verifikasi Petugas<\/span>/);
    assert.match(verifyPage, /Email Anda sudah berhasil dikonfirmasi/);
    assert.match(verifyPage, /Setelah akun diverifikasi, Anda dapat menggunakan layanan Portal Warga\./);
});

test("card pending tidak menduplikasi tombol kembali ke dashboard", () => {
    assert.doesNotMatch(verificationGuard, /Kembali ke Dashboard/);
    assert.doesNotMatch(verificationGuard, /<Link\b/);
    assert.match(verificationGuard, /if \(pathname === "\/dashboard"\) return false;/);
    assert.match(dashboardPage, /if \(!isVerified\(profile\)\) return <PendingVerification \/>/);
});

test("dashboard pending memakai card informatif dan tetap mengarahkan akun ditolak", () => {
    const pendingCard = dashboardPage.slice(dashboardPage.indexOf("function PendingVerification()"), dashboardPage.indexOf("function Skeleton()"));
    assert.match(dashboardPage, /profile\?\.status_verifikasi === "Ditolak"\) router\.replace\("\/verification-rejected"\)/);
    assert.match(dashboardPage, /if \(!isVerified\(profile\)\) return <PendingVerification \/>/);
    assert.match(pendingCard, /Akun Menunggu Verifikasi/);
    assert.match(pendingCard, /<Link href="\/"[^>]*>Kembali ke Halaman Utama<\/Link>/);
    assert.equal((pendingCard.match(/<Link\b/g) ?? []).length, 1);
    assert.doesNotMatch(pendingCard, /Kembali ke Dashboard|href="\/dashboard"/);
    assert.match(pendingCard, /Akun Anda sedang menunggu verifikasi petugas\./);
    assert.match(pendingCard, /Petugas Kelurahan Tamansari sedang memverifikasi data NIK, KK, dan profil Anda\./);
    assert.match(pendingCard, /Menunggu Verifikasi/);
    assert.match(pendingCard, /Anda akan dapat menggunakan seluruh layanan setelah akun diverifikasi\./);
});

test("akun verified memakai card verified dan tidak memakai cabang pending", () => {
    assert.match(verifyPage, /accountVerified \? <div data-account-status="verified"/);
    assert.match(verifyPage, /Akun Anda Telah Diverifikasi/);
    assert.match(verifyPage, />Terverifikasi<\/span>/);
    assert.match(verifyPage, /Verifikasi akun oleh petugas Kelurahan Tamansari telah selesai/);
    assert.match(verifyPage, /: <div data-account-status="pending"/);
});

test("callback error umum memakai pesan manusiawi tanpa raw JSON", () => {
    assert.match(verifyPage, /title="Link Tidak Dapat Diproses"/);
    assert.match(verifyPage, /Link sudah tidak valid atau telah kedaluwarsa\. Silakan minta link baru\./);
    assert.match(verifyPage, /href="\/forgot-password"[^>]*>Minta Link Baru/);
});

test("password mismatch ditolak sebelum update dipanggil", () => {
    const mismatch = verifyPage.indexOf('if (password !== confirmation)');
    const update = verifyPage.indexOf("await updateWargaPassword(password)");
    assert.ok(mismatch >= 0 && mismatch < update);
    assert.match(verifyPage, /Konfirmasi password tidak sama\./);
});

test("UI auth memetakan error dan tidak merender JSON Supabase mentah", () => {
    assert.match(verifyPage, /getFriendlyMessage\(/);
    assert.match(messages, /export function getFriendlyMessage/);
    assert.doesNotMatch(verifyPage, /JSON\.stringify|error\.code|error_code/);
});

test("password dan token auth tidak dicatat ke log", () => {
    const authSources = `${forgotPage}\n${verifyPage}\n${loginPage}\n${registerPage}\n${registerRoute}\n${authService}`;
    assert.doesNotMatch(authSources, /console\.(?:log|debug|info|warn|error)\([^\n]*(?:password|access_token|refresh_token|recovery token)/i);
    assert.doesNotMatch(authSources, /localStorage\.setItem\([^\n]*(?:password|access_token|refresh_token)/i);
});