import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { getChangedFiles } from "./git-changes.mjs";

function fail(msg) {
	console.error(`✗ ${msg}`);
	process.exit(1);
}

function loadYaml(p) {
	const s = fs.readFileSync(p, "utf8");
	return YAML.parse(s);
}

const changed = getChangedFiles();

const codeTouched = changed.some(
	(p) =>
		p.startsWith("src/") || p.startsWith("spec/") || p.startsWith("tests/"),
);

if (!codeTouched) {
	console.log("✓ no relevant changes");
	process.exit(0);
}

const crFiles = changed.filter(
	(p) => p.startsWith("changes/") && /CR-.*\.ya?ml$/.test(p),
);
if (crFiles.length === 0) {
	fail(
		"changes/CR-*.yml が差分に存在しない。短文要求から CR を必ず作成すること。",
	);
}

const anyBpmnChanged = changed.some(
	(p) => p.startsWith("spec/process/") && p.endsWith(".bpmn"),
);
const anyDmnChanged = changed.some(
	(p) => p.startsWith("spec/decision/") && p.endsWith(".dmn"),
);
const anyGlossaryChanged = changed.some(
	(p) => p === "spec/glossary.yml" || p === "spec/glossary.md",
);
const anyContextMapChanged = changed.some(
	(p) => p === "spec/context-map.yml" || p === "spec/context-map.md",
);

for (const crPath of crFiles) {
	if (!fs.existsSync(crPath)) continue; // deleted case

	const cr = loadYaml(crPath);

	const cc = cr?.change_candidates;
	if (!cc) fail(`${crPath}: change_candidates がない`);

	const flags = {
		process_change: cc?.process_change?.value,
		decision_change: cc?.decision_change?.value,
		glossary_change: cc?.glossary_change?.value,
		contextmap_change: cc?.contextmap_change?.value,
	};

	for (const k of Object.keys(flags)) {
		if (typeof flags[k] !== "boolean") {
			fail(`${crPath}: ${k}.value は boolean 必須`);
		}
	}

	// If CR says true => required diffs must exist
	if (flags.process_change && !anyBpmnChanged)
		fail(
			`${crPath}: process_change=true だが spec/process/*.bpmn の差分がない`,
		);
	if (flags.decision_change && !anyDmnChanged)
		fail(
			`${crPath}: decision_change=true だが spec/decision/*.dmn の差分がない`,
		);
	if (flags.glossary_change && !anyGlossaryChanged)
		fail(`${crPath}: glossary_change=true だが spec/glossary.* の差分がない`);
	if (flags.contextmap_change && !anyContextMapChanged)
		fail(
			`${crPath}: contextmap_change=true だが spec/context-map.* の差分がない`,
		);
}

// If diffs exist => at least one CR must explicitly say true
function someCRTrue(key) {
	for (const crPath of crFiles) {
		if (!fs.existsSync(crPath)) continue;
		const cr = loadYaml(crPath);
		if (cr?.change_candidates?.[key]?.value === true) return true;
	}
	return false;
}

if (anyBpmnChanged && !someCRTrue("process_change"))
	fail(
		"spec/process の差分があるが、CRで process_change=true が宣言されていない",
	);
if (anyDmnChanged && !someCRTrue("decision_change"))
	fail(
		"spec/decision の差分があるが、CRで decision_change=true が宣言されていない",
	);
if (anyGlossaryChanged && !someCRTrue("glossary_change"))
	fail("glossary の差分があるが、CRで glossary_change=true が宣言されていない");
if (anyContextMapChanged && !someCRTrue("contextmap_change"))
	fail(
		"context-map の差分があるが、CRで contextmap_change=true が宣言されていない",
	);

console.log("✓ change packages ok");
