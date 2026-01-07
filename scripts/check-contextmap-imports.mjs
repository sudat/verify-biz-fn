import fs from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import YAML from "yaml";

function fail(msg) {
	console.error(`✗ ${msg}`);
	process.exit(1);
}

const cfgPath = "spec/context-map.yml";
if (!fs.existsSync(cfgPath)) {
	console.log("✓ context map skip (spec/context-map.yml not found)");
	process.exit(0);
}

const cfg = YAML.parse(fs.readFileSync(cfgPath, "utf8"));
const contexts = cfg?.contexts ?? [];
const allow = cfg?.allow ?? {};

if (contexts.length === 0) fail("spec/context-map.yml: contexts がない");

const ctxByRoot = contexts
	.map((c) => ({ key: c.key, root: c.root.replace(/\/+$/, "") }))
	.sort((a, b) => b.root.length - a.root.length);

function findCtx(filePath) {
	const p = filePath.replace(/\\/g, "/");
	return ctxByRoot.find((c) => p.startsWith(c.root + "/"))?.key ?? null;
}

function isApiSurfaceImport(spec) {
	// allow cross-context only via "@/contexts/<ctx>/api/..."
	return /^@\/contexts\/[^/]+\/api\//.test(spec);
}

const files = await fg([
	"src/**/*.{ts,tsx,js,jsx}",
	"!**/*.d.ts",
	"!**/node_modules/**",
]);

const importRe = /from\s+["']([^"']+)["']|require\(\s*["']([^"']+)["']\s*\)/g;

for (const f of files) {
	const fromCtx = findCtx(f);
	if (!fromCtx) continue;

	const s = fs.readFileSync(f, "utf8");
	for (const m of s.matchAll(importRe)) {
		const spec = m[1] ?? m[2];
		if (!spec) continue;

		// Normalize "@/..."
		const normalized = spec.startsWith("@/") ? spec : spec;

		// Detect target context by import path convention "@/contexts/<ctx>/..."
		const m2 = normalized.match(/^@\/contexts\/([^/]+)\//);
		if (!m2) continue;

		const toCtx = m2[1];
		if (toCtx === fromCtx) continue;

		const allowed = new Set(allow[fromCtx] ?? []);
		if (!allowed.has(toCtx)) {
			fail(
				`${f}: ${fromCtx} -> ${toCtx} が context-map.yml で許可されていない import: ${spec}`,
			);
		}
		if (!isApiSurfaceImport(normalized)) {
			fail(`${f}: cross-context import は api/ 経由のみ許可: ${spec}`);
		}
	}
}

console.log("✓ context map imports ok");
