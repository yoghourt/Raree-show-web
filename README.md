# Raree Show

> An AI-powered literary visualization tool — navigate complex works like *A Song of Ice and Fire* through an immersive, map-based scene experience.
>
> 用 AI 驱动的文学可视化工具，通过沉浸式地图场景切片，帮助读者理解复杂的文学作品。

**[Live Demo](https://raree-show-web.vercel.app)** · **[Admin CMS](https://raree-show-admin.vercel.app)**

---

## Screenshots / Demo
<!-- TODO: 录制 GIF 后替换此处 -->
<!-- Recommended: 场景幻灯片页 + AI 问答悬浮球 的操作录屏，时长 30-60 秒 -->

> 🎬 Demo GIF coming soon

---

## Features

- **Scene Slideshow** — Navigate literary scenes through a map-based slideshow interface with animated panning across a Westeros map.
  地图背景幻灯片，支持平移动画，沉浸式场景切换。

- **Character Bar** — Portrait images of scene characters with staggered entrance animations.
  顶部人物栏，Cloudinary 托管肖像图 + 进场动效。

- **Event Cards** — Each scene includes chapter info, summary, and categorized tags.
  事件卡片展示章节信息、场景摘要与标签。

- **AI Scene Assistant** — Floating chat widget powered by Gemini API with streaming output. Ask anything about the current scene.
  Gemini API 驱动的悬浮 AI 问答组件，流式输出，随时提问当前场景。

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 App Router |
| Language | TypeScript |
| Styling | Tailwind CSS |
| AI | Google Gemini API (streaming) |
| Image hosting | Cloudinary |
| Deployment | Vercel |

---

## Architecture

```
Browser
   │
   ▼
Vercel · Next.js 14 App Router
   ├── Server Components      (SSR, data fetch, SEO)
   ├── Client Components      (animations, interactions)
   └── API Routes
          ├──▶ Gemini API       (scene Q&A, streaming)
          ├──▶ Cloudinary       (portrait images, CDN)
          └──▶ JSON files       (characters, locations, scenes)

Raree Show Admin              (Content CMS, Supabase — in progress)
```

---

## Data

| Dataset | Count | Source |
|---|---|---|
| Characters | 136 | MediaWiki scraper (custom Node.js) |
| Locations | 256 | MediaWiki scraper (custom Node.js) |
| Scenes | 8 | Hand-curated, growing with reading progress |
| Portrait images | 74 | Scraped + hosted on Cloudinary |

> 场景数据随原著阅读进度持续补充，目前覆盖前两卷核心场景。

---

## ADR — Architectural Decision Records

<!-- 关键技术决策记录，面试时可直接引用 -->

### ADR-001 · Next.js App Router over Pages Router

**Decision**: Use Next.js 14 App Router.

**Reasoning**: Server Components enable data fetching without client-side waterfalls. API Routes allow hiding the Gemini API key server-side. Seamless Vercel deployment with zero configuration.

### ADR-002 · JSON files over database (Phase 1)

**Decision**: Store characters, locations, and scenes as static JSON files.

**Reasoning**: Fastest path to a working prototype. No infrastructure overhead during content validation. Planned migration to Supabase in Phase 2 via the Admin CMS.

### ADR-003 · Cloudinary for image hosting

**Decision**: Host all portrait images on Cloudinary instead of committing them to the repository.

**Reasoning**: GitHub has a per-push size limit. 74 portrait images would bloat the repository and slow CI. Cloudinary provides a free 25 GB tier with global CDN.

### ADR-004 · Proxy only in local development

**Decision**: `HTTPS_PROXY` is set locally only, not on Vercel.

**Reasoning**: Vercel servers are deployed outside mainland China and connect to Google APIs directly. The proxy is only needed in the local development environment.

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
# Fill in: GEMINI_API_KEY, NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
# If in mainland China, also set: HTTPS_PROXY

# 4. Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                        # Works list (homepage)
│   ├── works/[workId]/
│   │   ├── page.tsx                    # Work detail page
│   │   └── scenes/[sceneId]/
│   │       └── page.tsx                # Scene slideshow (Server Component)
│   └── api/
│       └── scene-assistant/
│           └── route.ts                # Gemini API Route Handler
├── components/raree/
│   ├── SceneExperience.tsx             # Scene client component (animations)
│   └── SceneAssistant.tsx             # AI chat floating widget
└── lib/
    ├── types.ts                        # TypeScript type definitions
    └── data.ts                         # Data access layer
data/
├── characters.json                     # 136 characters
├── locations.json                      # 256 locations
├── scenes.json                         # 8 scenes
└── portrait-urls.json                  # Cloudinary URL mapping
```

---

## Roadmap

- [x] Scene slideshow with map panning
- [x] AI scene assistant (Gemini API, streaming)
- [x] Admin CMS scaffold (raree-show-admin)
- [ ] Admin CMS connected to Supabase
- [ ] Expand scene coverage (ongoing with reading)
- [ ] Content SDK documentation

---

## License

MIT
