#!/usr/bin/env node
/**
 * PR body structural validator (CHANGE_TELEMETRY_SPEC transport closure).
 * Requires explicit --type; no prose-based PR type inference.
 *
 * Implementation constants (not constitutional):
 * - MIN_SECTION_CHARS = 20 non-whitespace characters per section
 */
import { readFile } from "node:fs/promises";

/** @type {Record<string, string[]>} */
const CONTRACTS = {
  default: ["What", "Why", "How", "Validation", "Refs"],
  adr: [
    "What",
    "Why",
    "How",
    "Validation",
    "Refs",
    "Decision",
    "Alternatives Considered",
    "Trade-offs",
  ],
  spike: [
    "What",
    "Why",
    "How",
    "Validation",
    "Refs",
    "Goal",
    "Findings",
    "Risks",
  ],
  debug: [
    "What",
    "Why",
    "How",
    "Validation",
    "Refs",
    "Problem",
    "Investigation",
    "Root Cause",
  ],
};

const VALID_TYPES = Object.keys(CONTRACTS);
const MIN_SECTION_CHARS = 20;

/**
 * @param {string} body
 * @returns {Map<string, string>}
 */
function parseSections(body) {
  /** @type {Map<string, string>} */
  const sections = new Map();
  const lines = body.split(/\r?\n/);
  let current = null;
  /** @type {string[]} */
  let buffer = [];

  for (const line of lines) {
    const match = line.match(/^##\s+(.+?)\s*$/);
    if (match) {
      if (current !== null) {
        sections.set(current, buffer.join("\n"));
      }
      current = match[1].trim();
      buffer = [];
      continue;
    }
    if (current !== null) {
      buffer.push(line);
    }
  }
  if (current !== null) {
    sections.set(current, buffer.join("\n"));
  }
  return sections;
}

/**
 * @param {string} raw
 */
function normalizedContent(raw) {
  return raw
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^---\s*$/gm, "")
    .replace(/[#>*`\[\]_~-]/g, "")
    .replace(/\s+/g, "");
}

/**
 * @param {string} name
 * @param {string} raw
 */
/**
 * @param {string} raw
 */
function sectionCharCount(raw) {
  return normalizedContent(raw).length;
}

function usage() {
  console.error(`Usage: node scripts/governance/validate-pr-body.mjs --type <${VALID_TYPES.join("|")}> (--file <path> | --body-text <text>)

PR type MUST be explicit. No prose-based type detection.`);
}

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  let type = null;
  let file = null;
  let bodyText = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--type" && argv[i + 1]) {
      type = argv[++i];
    } else if (arg === "--file" && argv[i + 1]) {
      file = argv[++i];
    } else if (arg === "--body-text" && argv[i + 1]) {
      bodyText = argv[++i];
    } else if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
  }

  return { type, file, bodyText };
}

const { type, file, bodyText } = parseArgs(process.argv.slice(2));

if (!type) {
  console.error("validate-pr-body: --type is required (explicit PR type; no default inference).");
  usage();
  process.exit(1);
}

if (!VALID_TYPES.includes(type)) {
  console.error(
    `validate-pr-body: invalid --type "${type}" (expected: ${VALID_TYPES.join(", ")}).`,
  );
  process.exit(1);
}

let body;
if (file) {
  body = await readFile(file, "utf8");
} else if (bodyText !== null) {
  body = bodyText;
} else if (!process.stdin.isTTY) {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  body = Buffer.concat(chunks).toString("utf8");
} else {
  console.error("validate-pr-body: provide --file, --body-text, or stdin.");
  usage();
  process.exit(1);
}

if (!body || !body.trim()) {
  console.error("validate-pr-body: PR body is empty.");
  process.exit(1);
}

const sections = parseSections(body);
const required = CONTRACTS[type];
/** @type {string[]} */
const missing = [];
/** @type {string[]} */
const tooShort = [];

for (const name of required) {
  if (!sections.has(name)) {
    missing.push(name);
    continue;
  }
  const count = sectionCharCount(sections.get(name) ?? "");
  if (count < MIN_SECTION_CHARS) {
    tooShort.push(
      `${name} (${count} non-whitespace chars, need >= ${MIN_SECTION_CHARS})`,
    );
  }
}

if (missing.length > 0 || tooShort.length > 0) {
  console.error(`validate-pr-body: failed for --type ${type}`);
  if (missing.length > 0) {
    console.error(`  missing sections: ${missing.join(", ")}`);
  }
  if (tooShort.length > 0) {
    console.error(`  insufficient content: ${tooShort.join("; ")}`);
  }
  process.exit(1);
}

console.log(`validate-pr-body: ok (--type ${type}, ${required.length} sections)`);
process.exit(0);
