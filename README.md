# Raree Show

> A narrative visualization and story interaction platform — explore literary works through map-based scene navigation with a visibility-aware AI assistant.
>
> 叙事可视化与故事交互平台：地图场景导航 + 防剧透 AI 阅读助手。

**[Live Demo](https://raree-show-web.vercel.app)** · **[Admin CMS](https://raree-show-admin.vercel.app)**

---

## Screenshots / Demo
<!-- TODO: 录制 GIF 后替换此处 -->
<!-- Recommended: 场景幻灯片页 + AI 问答悬浮球 的操作录屏，时长 30-60 秒 -->

> 🎬 Demo GIF coming soon

---

## Features

- **Scene Slideshow** — Navigate literary scenes through a map-based slideshow with animated panning across the story world.
  地图背景幻灯片，支持平移动画，场景与幻灯切换。

- **Character Bar** — Animated character portraits for the current scene.
  当前场景人物肖像栏，带进场动效。

- **Scene Caption Panel** — Slide captions, chapter title, and scene progress in the central reader panel.
  中央阅读面板：幻灯 caption、章节标题与场景进度。

- **Visibility-aware Scene Assistant** — Progress-bound, streaming Q&A about the current scene. Retrieval and prompts respect what the reader has actually reached.
  随阅读进度约束的悬浮 AI 助手，流式输出；检索与提示均遵循已读边界，避免剧透。

- **Admin CMS** — Separate admin panel for managing works, scenes, characters, and locations with Supabase as the shared data layer.
  独立 Admin 后台管理作品、场景、角色、地点，数据实时同步到主站。

---

## Runtime Architecture

The Scene Assistant runtime enforces spoiler boundaries in the pipeline — not only in prompts.

```text
Client Progress
    → SQL Visibility Gate
    → Vector Rerank
    → Visibility Verification (SHA-256)
    → Gemini Generation
```

- **SQL visibility authorization** — Reading progress constrains which scenes may enter retrieval.
- **Bounded semantic reranking** — pgvector reranks only within the SQL-approved candidate set.
- **SHA-256 visibility verification** — Authorized semantic bytes are verified before any LLM call.
- **Governance submodule CI checks** — `npm run dev` and CI bootstrap verify the governance mount is present and readable.

An offline RAGAS harness (`npm run eval:ragas`) supports local evaluation of retrieval governance.

Deep dive: [`docs/runtime-architecture.md`](docs/runtime-architecture.md)

---

## ADR Index

| ADR | Topic | Status |
|-----|-------|--------|
| [ADR-001](docs/adr/001-pgvector-as-vector-store.md) | pgvector as vector store | Accepted |
| [ADR-002](docs/adr/002-hybrid-rag-retrieval.md) | Hybrid RAG visibility boundary | Accepted |
| [ADR-003](docs/adr/003-multi-provider-ai-runtime.md) | Multi-provider AI runtime | **Planned / not deployed** |

ADR-003 describes a future generation-layer failover design. **Current production uses a single Gemini path only.**

---

## Local Development

```bash
# 1. Clone
git clone https://github.com/yoghourt/raree-show-web.git
cd raree-show-web

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Fill in:
# GEMINI_API_KEY
# NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
# SUPABASE_SERVICE_ROLE_KEY   # server-only; Scene Assistant retrieval
# HTTPS_PROXY                 # optional; mainland China local dev

# 4. Run dev server
npm run dev
```

`npm run dev` runs bootstrap first (syncs the `governance/` submodule). First clone requires network access.

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```text
src/                 # Next.js app, Scene Experience, Scene Assistant API
docs/                # ADRs, specs, runtime-architecture.md
eval/                # Offline RAGAS evaluation harness
scripts/governance/  # Governance bootstrap & CI checks
governance/          # Shared governance submodule (synced at dev/CI)
```

---

## Roadmap

### Current Runtime

- [x] Scene slideshow + map navigation
- [x] Visibility-aware Scene Assistant (Hybrid RAG)
- [x] SQL visibility gate + bounded vector rerank
- [x] SHA-256 visibility verification
- [x] Admin CMS + Supabase data layer
- [x] Governance CI checks (`check:governance`)
- [x] Offline RAGAS harness (`npm run eval:ragas`)

### Planned

- [ ] Provider abstraction & transparent failover (ADR-003)
- [ ] Runtime telemetry / provider-switch observability
- [ ] Evaluation automation (CI integration — not current)
- [ ] Migrate characters and locations to Supabase
- [ ] Expand scene coverage (ongoing with reading)

---

## License

MIT
