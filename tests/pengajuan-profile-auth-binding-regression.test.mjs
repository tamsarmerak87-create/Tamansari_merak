import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const serviceSource = readFileSync(new URL("../services/surat-online.service.ts", import.meta.url), "utf8");
const routeSource = readFileSync(new URL("../app/api/surat-online/pengajuan/route.ts", import.meta.url), "utf8");

test("pengajuan resolves profile by authenticated auth user id using the deployed schema", () => {
    assert.match(serviceSource, /\.from\("warga_profiles"\)[\s\S]*?\.eq\("id", authenticatedUserId\)[\s\S]*?\.maybeSingle\(\)/);
    assert.doesNotMatch(serviceSource, /\.from\("warga_profiles"\)[\s\S]*?\.eq\("user_id", authenticatedUserId\)/);
    assert.match(serviceSource, /profileColumns\s*=\s*[^;]*\bagama\b/);
    assert.match(serviceSource, /agama:\s*profile\.agama/);
});

test("authenticated identity comes from the bearer token, not the request body", () => {
    assert.match(routeSource, /auth\.getUser\(accessToken\)/);
    assert.match(routeSource, /createSubmission\(body, authData\.user\.id\)/);
    assert.doesNotMatch(serviceSource, /authenticatedUserId\s*=\s*formData\./);
});

test("marital and employment statuses remain authoritative from the verified profile", () => {
    assert.match(serviceSource, /status_perkawinan:\s*profile\.status_perkawinan/);
    assert.match(serviceSource, /status_pekerjaan:\s*profile\.status_pekerjaan/);
    assert.doesNotMatch(serviceSource, /profile\.status_(?:perkawinan|pekerjaan)\s*\?\?/);
});

test("client preserves the API status and original response body on POST failure", () => {
    const clientSource = readFileSync(new URL("../components/pengajuan/surat-online-client.tsx", import.meta.url), "utf8");
    assert.match(clientSource, /console\.error\("\[PENGAJUAN API ERROR\]",\s*\{[\s\S]*?status:\s*response\.status,[\s\S]*?statusText:\s*response\.statusText,[\s\S]*?body/);
    assert.match(clientSource, /const responseText = await response\.text\(\)/);
});