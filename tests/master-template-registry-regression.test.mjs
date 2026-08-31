import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const registry = readFileSync("services/official-document.ts", "utf8");
const finalizer = readFileSync("services/official-letter-finalization.ts", "utf8");

test("33 services share the Domisili master engine and fail closed", () => {
  assert.match(registry, /MASTER_LAYANAN\.map/);
  assert.match(registry, /masterTemplateId: "DOMISILI_OFFICIAL_V1"/);
  assert.match(registry, /layoutEngine: "DOMISILI_MASTER"/);
  assert.match(registry, /CONFIGURATION_REQUIRED/);
  assert.match(finalizer, /if \(!template\) return jsonError/);
});

test("authoritative identifiers and server numbering remain separate", () => {
  assert.match(finalizer, /claim_official_letter_finalization/);
  assert.match(finalizer, /verificationUrl = `\$\{site\}\/verifikasi\/\$\{code\}`/);
  assert.match(finalizer, /QRCode\.toBuffer\(verificationUrl/);
});