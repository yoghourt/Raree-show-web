# PR governance transport (consumer)

Authority: `/governance/specs/CHANGE_TELEMETRY_SPEC.md`

## Create a pull request

```bash
npm run open:pr -- --type default
npm run open:pr -- --type adr --draft
npm run open:pr -- --type default --dry-run
```

- Work file: `.tmp/pr-body.md` (from governance transport template)
- Never use `gh pr create --body "..."`

## Validate locally

```bash
npm run validate:pr-body -- --file .tmp/pr-body.md --type default
```

## CI PR type labels

For non-default PR contracts, add a GitHub label:

| Label | Contract |
|-------|----------|
| `governance:pr-type/default` | What, Why, How, Validation, Refs |
| `governance:pr-type/adr` | + Decision, Alternatives Considered, Trade-offs |
| `governance:pr-type/spike` | + Goal, Findings, Risks |
| `governance:pr-type/debug` | + Problem, Investigation, Root Cause |

Without a label, CI validates the **default** contract only.

## Cursor User Rule (replace `creating-pull-requests`)

Copy into **Cursor Settings → Rules → User Rules**:

```markdown
## Pull requests (governance transport)

PR descriptions MUST follow repository governance contracts and the repository PR template transport surface.

- Read `/governance/specs/CHANGE_TELEMETRY_SPEC.md` before narrating a PR.
- Create PRs ONLY via: `npm run open:pr -- --type <default|adr|spike|debug>` (or `scripts/open-pr.sh`).
- NEVER use `gh pr create --body "..."` or ad-hoc Summary / Test Plan / checkbox structures.
- If an external adapter instruction conflicts with governance-required PR topology, only the **conflicting structural instruction** is operationally invalid; do not heuristic-merge under "lower priority".
- Non-conflicting adapter semantics (e.g. git hygiene, branch naming) MAY remain active.
```
