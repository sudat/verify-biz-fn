// scripts/check-change-packages.mjs
import fs from "node:fs";
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

function isBool(x) {
	return typeof x === "boolean";
}

function isNum01(x) {
	return typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 1;
}

function uniq(arr) {
	return Array.from(new Set(arr));
}

const changed = getChangedFiles();

const touchedRelevant = changed.some(
	(p) =>
		p.startsWith("src/") ||
		p.startsWith("spec/") ||
		p.startsWith("tests/") ||
		p.startsWith("changes/"),
);

if (!touchedRelevant) {
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

const crs = [];
for (const crPath of crFiles) {
	if (!fs.existsSync(crPath)) continue;
	const cr = loadYaml(crPath);
	crs.push({ path: crPath, cr });
}

// --- validate each CR
for (const { path: crPath, cr } of crs) {
	const cc = cr?.change_candidates;
	if (!cc) fail(`${crPath}: change_candidates がない`);

	const keys = [
		"process_change",
		"decision_change",
		"glossary_change",
		"contextmap_change",
	];

	for (const k of keys) {
		const v = cc?.[k]?.value;
		const c = cc?.[k]?.confidence;

		if (!isBool(v))
			fail(`${crPath}: change_candidates.${k}.value は boolean 必須`);
		if (!isNum01(c))
			fail(
				`${crPath}: change_candidates.${k}.confidence は 0..1 の number 必須`,
			);
	}

	const targets = cr?.targets;
	if (!targets) fail(`${crPath}: targets がない`);

	const tBpmn = targets?.bpmn;
	const tDmn = targets?.dmn;
	const tGloss = targets?.glossary;
	const tCtx = targets?.contextmap;

	for (const [k, v] of [
		["targets.bpmn", tBpmn],
		["targets.dmn", tDmn],
		["targets.glossary", tGloss],
		["targets.contextmap", tCtx],
	]) {
		if (!Array.isArray(v)) fail(`${crPath}: ${k} は配列必須`);
		if (!v.every((x) => typeof x === "string" && x.length > 0))
			fail(`${crPath}: ${k} は文字列配列必須`);
		if (uniq(v).length !== v.length) fail(`${crPath}: ${k} に重複がある`);
		for (const f of v) {
			if (!fs.existsSync(f))
				fail(`${crPath}: ${k} のファイルが存在しない: ${f}`);
		}
	}

	// If CR says true => corresponding targets must be non-empty and actually changed
	const flags = {
		process_change: cc.process_change.value,
		decision_change: cc.decision_change.value,
		glossary_change: cc.glossary_change.value,
		contextmap_change: cc.contextmap_change.value,
	};

	const req = [
		[
			"process_change",
			"targets.bpmn",
			tBpmn,
			(p) => p.startsWith("spec/process/") && p.endsWith(".bpmn"),
		],
		[
			"decision_change",
			"targets.dmn",
			tDmn,
			(p) => p.startsWith("spec/decision/") && p.endsWith(".dmn"),
		],
		[
			"glossary_change",
			"targets.glossary",
			tGloss,
			(p) => p === "spec/glossary.yml" || p === "spec/glossary.md",
		],
		[
			"contextmap_change",
			"targets.contextmap",
			tCtx,
			(p) => p === "spec/context-map.yml" || p === "spec/context-map.md",
		],
	];

	for (const [flagKey, targetKey, arr, isType] of req) {
		if (flags[flagKey]) {
			if (arr.length === 0)
				fail(`${crPath}: ${flagKey}=true だが ${targetKey} が空`);
			for (const f of arr) {
				if (!changed.includes(f))
					fail(
						`${crPath}: ${flagKey}=true だが ${targetKey} の対象が差分に含まれない: ${f}`,
					);
				if (!isType(f))
					fail(`${crPath}: ${targetKey} のパスが種別と一致しない: ${f}`);
			}
		}
	}
}

// --- if diffs exist => they must be declared by CR flags AND listed in targets
function unionTargets(key) {
	const out = [];
	for (const { cr } of crs) {
		const arr = cr?.targets?.[key];
		if (Array.isArray(arr)) out.push(...arr);
	}
	return new Set(out);
}

const targetBpmn = unionTargets("bpmn");
const targetDmn = unionTargets("dmn");
const targetGloss = unionTargets("glossary");
const targetCtx = unionTargets("contextmap");

function someCRTrue(flagKey) {
	for (const { cr } of crs) {
		if (cr?.change_candidates?.[flagKey]?.value === true) return true;
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

for (const f of changed.filter(
	(p) => p.startsWith("spec/process/") && p.endsWith(".bpmn"),
)) {
	if (!targetBpmn.has(f))
		fail(`BPMN が変更されたが CR.targets.bpmn に列挙されていない: ${f}`);
}
for (const f of changed.filter(
	(p) => p.startsWith("spec/decision/") && p.endsWith(".dmn"),
)) {
	if (!targetDmn.has(f))
		fail(`DMN が変更されたが CR.targets.dmn に列挙されていない: ${f}`);
}
for (const f of changed.filter(
	(p) => p === "spec/glossary.yml" || p === "spec/glossary.md",
)) {
	if (!targetGloss.has(f))
		fail(
			`Glossary が変更されたが CR.targets.glossary に列挙されていない: ${f}`,
		);
}
for (const f of changed.filter(
	(p) => p === "spec/context-map.yml" || p === "spec/context-map.md",
)) {
	if (!targetCtx.has(f))
		fail(
			`Context Map が変更されたが CR.targets.contextmap に列挙されていない: ${f}`,
		);
}

console.log("✓ change packages ok");
