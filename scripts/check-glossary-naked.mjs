// scripts/check-glossary-naked.mjs
import fs from "node:fs";
import fg from "fast-glob";
import YAML from "yaml";

function fail(msg) {
	console.error(`✗ ${msg}`);
	process.exit(1);
}

function escapeRegExp(s) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const glossaryPath = "spec/glossary.yml";
if (!fs.existsSync(glossaryPath)) {
	console.log("✓ naked terms skip (spec/glossary.yml not found)");
	process.exit(0);
}

const glossary = YAML.parse(fs.readFileSync(glossaryPath, "utf8"));
const wrappedTerms = (glossary?.terms ?? []).map((t) => t.term).filter(Boolean);

if (wrappedTerms.length === 0) fail("spec/glossary.yml に terms がない");

// «請求書» -> 請求書
const plainTerms = wrappedTerms
	.filter((t) => /^«.+»$/.test(t))
	.map((t) => t.slice(1, -1))
	.filter((t) => t.length > 0);

const files = [
	...(await fg("spec/process/**/*.bpmn")),
	...(await fg("spec/decision/**/*.dmn")),
];

function extractLabels(xml) {
	const labels = [];

	// attributes: name="...", label="..."
	for (const re of [
		/(name|label)\s*=\s*"([^"]*)"/g,
		/(name|label)\s*=\s*'([^']*)'/g,
	]) {
		let m;
		while ((m = re.exec(xml)) !== null) labels.push(m[2]);
	}

	// element: <text>...</text> (DMN etc.)
	{
		const re = /<text>([\s\S]*?)<\/text>/g;
		let m;
		while ((m = re.exec(xml)) !== null)
			labels.push(m[1].replace(/\s+/g, " ").trim());
	}

	return labels.filter((s) => s.length > 0);
}

const violations = [];

for (const f of files) {
	const xml = fs.readFileSync(f, "utf8");
	const labels = extractLabels(xml);

	for (const label of labels) {
		for (const term of plainTerms) {
			// detect "term" not wrapped by «»
			const re = new RegExp(`(?<!«)${escapeRegExp(term)}(?!»)`, "g");
			if (re.test(label)) {
				violations.push({ file: f, term, label });
			}
		}
	}
}

if (violations.length > 0) {
	const out = violations
		.slice(0, 50)
		.map((v) => `${v.file}: 裸の用語 '${v.term}' -> ${v.label}`)
		.join("\n");
	fail(
		`Glossary 用語が «» でラップされていない箇所がある（先頭50件）:\n${out}`,
	);
}

console.log("✓ naked terms ok");
