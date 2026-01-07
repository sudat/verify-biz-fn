import fs from "node:fs";
import fg from "fast-glob";
import YAML from "yaml";

function fail(msg) {
	console.error(`✗ ${msg}`);
	process.exit(1);
}

const glossaryPath = "spec/glossary.yml";
if (!fs.existsSync(glossaryPath)) {
	console.log("✓ glossary skip (spec/glossary.yml not found)");
	process.exit(0);
}

const glossary = YAML.parse(fs.readFileSync(glossaryPath, "utf8"));
const terms = new Set((glossary?.terms ?? []).map((t) => t.term));

if (terms.size === 0) fail("spec/glossary.yml に terms がない");

const files = [
	...(await fg("spec/process/**/*.bpmn")),
	...(await fg("spec/decision/**/*.dmn")),
];

const tokenRe = /«([^»]+)»/g;

const missing = new Map(); // term -> [file...]

for (const f of files) {
	const s = fs.readFileSync(f, "utf8");
	for (const m of s.matchAll(tokenRe)) {
		const term = `«${m[1]}»`;
		if (!terms.has(term)) {
			if (!missing.has(term)) missing.set(term, []);
			missing.get(term).push(f);
		}
	}
}

if (missing.size > 0) {
	const lines = [];
	for (const [term, fsx] of missing.entries()) {
		lines.push(`${term} -> ${Array.from(new Set(fsx)).join(", ")}`);
	}
	fail(`Glossary 未定義の «用語» が見つかった:\n${lines.join("\n")}`);
}

console.log("✓ glossary refs ok");
