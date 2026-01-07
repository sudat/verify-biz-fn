import { execSync } from "node:child_process";
import fs from "node:fs";

function sh(cmd) {
	return execSync(cmd, { stdio: ["ignore", "pipe", "pipe"] })
		.toString()
		.trim();
}

function parseEvent() {
	const p = process.env.GITHUB_EVENT_PATH;
	if (!p || !fs.existsSync(p)) return null;
	try {
		return JSON.parse(fs.readFileSync(p, "utf8"));
	} catch {
		return null;
	}
}

export function getChangedFiles() {
	const ev = parseEvent();

	// PR in GitHub Actions
	if (ev?.pull_request?.base?.sha && ev?.pull_request?.head?.sha) {
		const base = ev.pull_request.base.sha;
		const head = ev.pull_request.head.sha;
		const out = sh(`git diff --name-only ${base}...${head}`);
		return out ? out.split("\n").filter(Boolean) : [];
	}

	// Fallback: compare against origin/main (needs fetch-depth 0 + origin main fetched)
	try {
		const base = sh("git merge-base HEAD origin/main");
		const out = sh(`git diff --name-only ${base}...HEAD`);
		return out ? out.split("\n").filter(Boolean) : [];
	} catch {
		const out = sh("git diff --name-only HEAD~1..HEAD");
		return out ? out.split("\n").filter(Boolean) : [];
	}
}
