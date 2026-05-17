# Repository AI Adapter

## Governance Authority

Read (authoritative; do not duplicate locally):

- `/governance/FOUNDATION.md`
- `/governance/RETRIEVAL.md`
- `/governance/NAVIGATION.md`
- `/governance/STREAMING.md`
- `/governance/ADR_RULES.md`

These files are the authoritative governance source. Load from the local filesystem at `/governance` only.

Before governance-aware work, run `npm run check:governance`. Missing governance MUST fail deterministically (`npm run bootstrap`). `npm run dev` runs bootstrap first and syncs `/governance` to `origin/main` latest.

## Repository Runtime Notes

<!-- BEGIN:nextjs-agent-rules -->
### Next.js

This is NOT the Next.js you know. This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

### Raree Show (consumer)

- Branch naming: `feat/xxx` or `fix/xxx`
- Scene navigation: no `router.push` — use `window.history.replaceState` + client state
- Map coordinates: stored as 0–1 floats
- CSS tokens: `--rs-wood-dark`, `--rs-wood-mid`, `--rs-gold`, `--rs-gold-dim`, `--rs-text`, `--rs-text-dim`
- `scenes.tsid` is the business ID for WHERE clauses (not `scenes.id`)
- `story_images_v2` jsonb shape: `[{url, caption}]`
- `SceneExperience` must NOT use `key={scene.id}`
- Repo specs/ADRs under `docs/specs/` and `docs/adr/` supplement governance for this codebase; on conflict with `/governance/*`, governance wins unless architecture explicitly updates ADR/Spec
