import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const clientPath = new URL("../components/pengajuan/surat-online-client.tsx", import.meta.url);
const servicePath = new URL("../services/surat-online.service.ts", import.meta.url);
const routePath = new URL("../app/api/surat-online/pengajuan/route.ts", import.meta.url);

test("Keperluan uses canonical purpose state through validation and POST payload", async () => {
    const source = await readFile(clientPath, "utf8");

    assert.match(source, /<Field label="Keperluan \*"[\s\S]*?<textarea name="purpose"[\s\S]*?value=\{form\.purpose\}[\s\S]*?onChange=\{\(e\) => update\("purpose", e\.target\.value\)\}[\s\S]*?required/);
    assert.match(source, /const purpose = form\.purpose\?\.trim\(\) \?\? "";/);
    assert.match(source, /const requiredFields:[\s\S]*?"purpose"/);
    assert.match(source, /keperluan: purpose,/);
});

test("submission resolves the verified profile by authenticated Supabase UID", async () => {
    const source = await readFile(servicePath, "utf8");
    const route = await readFile(routePath, "utf8");

    assert.match(source, /from\("warga_profiles"\)[\s\S]*?\.eq\("id", authenticatedUserId\)/);
    assert.doesNotMatch(source, /from\("warga_profiles"\)[\s\S]*?\.eq\("user_id", authenticatedUserId\)/);
    assert.match(route, /createSubmission\(body, authData\.user\.id\)/);
});