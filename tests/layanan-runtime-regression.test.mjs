import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(new URL("../app/layanan/page.tsx", import.meta.url), "utf8");
const repositorySource = readFileSync(new URL("../services/repository.ts", import.meta.url), "utf8");

test("layanan waits for a request before querying privileged server data", () => {
    const connectionCall = pageSource.indexOf("await connection()");
    const servicesQuery = pageSource.indexOf("publicRepository.getServices()");

    assert.match(pageSource, /import\s*{\s*connection\s*}\s*from\s*["']next\/server["']/);
    assert.ok(connectionCall >= 0, "the page must opt into request-time execution with connection()");
    assert.ok(servicesQuery > connectionCall, "the services query must run after the request-time boundary");
    assert.doesNotMatch(pageSource, /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/);
});

test("public services use the RLS-enforced anon client instead of the service role", () => {
    const getServices = repositorySource.match(/getServices:\s*async\s*\(\)\s*=>\s*{([\s\S]*?)\n\s*},\n\s*getNews:/)?.[1];

    assert.ok(getServices, "the public services repository must exist");
    assert.match(getServices, /createSupabaseAnonClient\(\)/);
    assert.doesNotMatch(getServices, /createSupabaseServerClient\(\)|createSupabaseAdminClient\(\)/);
});