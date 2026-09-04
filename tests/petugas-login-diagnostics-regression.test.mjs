import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [route, authService, portal] = await Promise.all([
    readFile(new URL("../app/api/petugas/auth/login/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../services/admin-auth.service.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/petugas/petugas-portal.tsx", import.meta.url), "utf8"),
]);

test("credential invalid tetap memakai HTTP 401 dan pesan lama", () => {
    assert.match(route, /CREDENTIAL_ERROR\s*=\s*["']Username atau password salah\.["']/);
    assert.match(route, /failedResponse\s*=.*status:\s*401/);
    assert.match(route, /if \(!petugas\?\.password_hash \|\| isAdmin\(petugas\) \|\| !isPetugas\(petugas\)\) return failedResponse\(\)/);
    assert.match(route, /bcrypt\.compare\(password, petugas\.password_hash\)/);
});

test("network, DNS, Supabase 5xx, configuration, dan internal error tidak menjadi credential error", () => {
    assert.match(route, /fetch failed\|enotfound\|econnrefused\|etimedout/);
    assert.match(route, /supabase_network_error/);
    assert.match(route, /status:\s*503/);
    assert.match(route, /supabase_configuration_error/);
    assert.match(route, /CONFIGURATION_ERROR/);
    assert.match(route, /internal_error/);
    assert.match(route, /INTERNAL_ERROR/);
    assert.match(authService, /const data = await response\.json\(\)\.catch\(\(\) => null\)/);
    assert.match(portal, /error instanceof Error \? error\.message/);
});

test("diagnostic logging dan response tidak membocorkan secret, password, hash, atau token", () => {
    assert.doesNotMatch(route, /console\.error\([^\n]*(?:password|password_hash|SERVICE_ROLE_KEY|ANON_KEY|SESSION_SECRET|token)/i);
    assert.doesNotMatch(route, /JSON\.stringify\(.*(?:password|password_hash)/i);
    assert.doesNotMatch(route, /message:\s*password_hash/);
    assert.match(route, /tamsar_petugas_session/);
});

test("login tetap membaca field dan membuat session cookie sukses", () => {
    assert.match(route, /\.from\("petugas"\)/);
    assert.match(route, /\.eq\("username", username\)/);
    assert.match(route, /\.eq\("is_active", true\)/);
    assert.match(route, /response\.cookies\.set\("tamsar_petugas_session"/);
});