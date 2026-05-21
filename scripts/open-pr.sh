#!/usr/bin/env bash
# Governance transport closure: template → .tmp/pr-body.md → validate → gh --body-file
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

WORK_FILE=".tmp/pr-body.md"
VALIDATOR="scripts/governance/validate-pr-body.mjs"

PR_TYPE=""
PR_TITLE=""
DRAFT=0
DRY_RUN=0

usage() {
  cat <<'EOF'
Usage: scripts/open-pr.sh --type <default|adr|spike|debug> [options]

Required:
  --type <default|adr|spike|debug>   Explicit PR contract (no prose inference)

Options:
  --title <title>                    PR title (default: current branch name)
  --draft                            Create draft PR (topology required; [TBD] allowed)
  --dry-run                          Validate only; do not call gh
  -h, --help                         Show this help

PR body is materialized at .tmp/pr-body.md from the governance transport template.
Never use: gh pr create --body "..."
EOF
}

die() {
  echo "open-pr: $*" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --type)
      PR_TYPE="${2:-}"
      shift 2
      ;;
    --title)
      PR_TITLE="${2:-}"
      shift 2
      ;;
    --draft)
      DRAFT=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      die "unknown argument: $1 (see --help)"
      ;;
  esac
done

if [[ -z "$PR_TYPE" ]]; then
  die "--type is required (explicit PR type; no default inference)"
fi

case "$PR_TYPE" in
  default) TEMPLATE_REL=".github/pull_request_template.md" ;;
  adr) TEMPLATE_REL="governance/templates/ADR_TEMPLATE.md" ;;
  spike) TEMPLATE_REL="governance/templates/SPIKE_TEMPLATE.md" ;;
  debug) TEMPLATE_REL="governance/templates/DEBUG_TEMPLATE.md" ;;
  *)
    die "invalid --type \"$PR_TYPE\" (expected: default, adr, spike, debug)"
    ;;
esac

if ! command -v gh >/dev/null 2>&1; then
  [[ "$DRY_RUN" -eq 1 ]] || die "gh CLI not found; install GitHub CLI or use --dry-run"
fi

echo "open-pr: running check:governance..."
npm run check:governance --silent

TEMPLATE_PATH="$REPO_ROOT/$TEMPLATE_REL"
[[ -f "$TEMPLATE_PATH" ]] || die "template not found: $TEMPLATE_REL (run: npm run bootstrap)"

mkdir -p .tmp
cp "$TEMPLATE_PATH" "$WORK_FILE"

if [[ -z "${EDITOR:-}" ]]; then
  if command -v vi >/dev/null 2>&1; then
    export EDITOR=vi
  elif command -v nano >/dev/null 2>&1; then
    export EDITOR=nano
  else
    die "no EDITOR set and vi/nano not found"
  fi
fi

echo "open-pr: edit $WORK_FILE (${EDITOR})..."
"$EDITOR" "$WORK_FILE"

echo "open-pr: validating PR body (--type $PR_TYPE)..."
node "$VALIDATOR" --type "$PR_TYPE" --file "$WORK_FILE"

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "open-pr: dry-run ok (skipped gh pr create)"
  exit 0
fi

if [[ -z "$PR_TITLE" ]]; then
  PR_TITLE="$(git branch --show-current 2>/dev/null || true)"
  [[ -n "$PR_TITLE" ]] || die "--title required (could not infer branch name)"
fi

GH_ARGS=(pr create --title "$PR_TITLE" --body-file "$WORK_FILE")
if [[ "$DRAFT" -eq 1 ]]; then
  GH_ARGS+=(--draft)
fi

# Fail fast if something tries inline --body
for arg in "${GH_ARGS[@]}"; do
  [[ "$arg" == "--body" ]] && die "inline --body is forbidden; use --body-file transport only"
done

echo "open-pr: gh ${GH_ARGS[*]}"
gh "${GH_ARGS[@]}"

echo "open-pr: done"
