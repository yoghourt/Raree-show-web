---

# Raree Show — Project Context

> **TL;DR** — Raree Show 是一个 Next.js 16 + Supabase + Gemini 的文学可视化项目,前端 `raree-show-web` 提供"拉洋片"风格的场景幻灯片体验,后台 `raree-show-admin` 提供内容 CMS。本文档覆盖两个仓库的技术栈、数据模型、组件架构、设计决策和工作流约定。
>
> **Language note**: This document is currently in Chinese as a placeholder. An English version will land in a follow-up commit.
>
> **Last updated**: Day 11 (2026-04-13)

---

## 基本信息

- 阶段:Phase 1(Day 1–20,AI 集成 + 协作 artifacts)
- 沟通语言:中文(决策、规划、复盘)
- 输出语言:英文(PR 描述、README、ADR、demo UI、简历)
- 仓库结构:raree-show-web(前端)+ raree-show-admin(后台)

---

## raree-show-web

**仓库**:https://github.com/yoghourt/raree-show-web
**线上**:https://raree-show-web.vercel.app
**技术栈**:Next.js 16 App Router · TypeScript · Tailwind CSS · framer-motion · Gemini API · Cloudinary · Supabase · Vercel

### 已完成

- 作品列表页(3D 书架)
- 场景幻灯片页 → 拉洋片装置版(Day 6 完成)
- Gemini API 集成(流式输出,AI 场景问答)
- README(架构、ADR、项目结构)
- works / scenes / characters / locations 全部 Supabase
- 删除作品详情页,点击作品直接跳转第一个场景
- works/[workId]/page.tsx 作为入口调度层
- Scene 类型对齐:chapter_number + chapter_title 替换 book + chapter
- story_images_v2 jsonb 迁移完成(Day 7)
- Server component 强制 force-dynamic(Day 8 PR #11)
- **docs/international-team-glossary.md 进 git**(Day 10)

### 场景页核心组件

- `SceneExperience.tsx` — 客户端组件,持有 currentSceneIndex + currentImageIndex state
- `ImageReel.tsx` — 拉洋片图片卡片(520×82vh,木质边框 + 铆钉 + 呼吸光晕)
- `CaptionDisplay.tsx` — 打字机文字面板(400px,docked 到 ImageReel 右侧)
- `SceneRopes.tsx` — 屏幕固定悬挂绳索,pull-and-spring 点击动画
- `SceneTimeCard.tsx` — 左上时间卡片(framer-motion 翻日历)
- `CharacterCardColumn.tsx` — 右下角色卡组(Heroes Charge 风格入场)
- `SceneNavButtons.tsx` — 切场景按钮
- `HomeButton.tsx` — 返回书架
- `MiniMap.tsx` — 左下小地图 + 红点定位
- `SceneAssistant.tsx` — AI 问答悬浮球(右下)

### 关键约定

- **导航流**:切场景必须用 `window.history.replaceState` + 客户端 state,**不能用 router.push**(会触发 server re-render,丢失地图平移动画)
- **SceneExperience 不能 key={scene.id}**,会导致整树重建
- **坐标系**:locations 表存 0–1 浮点数,与 CSS 解耦
- **地图过采样**:width 280%,height 220%,translate 系数 64%/54%
- **Caption fallback**(当前):`scene.story_images_v2[i].caption` → `scene.summary`
- **PR #13 待移除**:移除 summary 这一层 fallback

### CSS 变量(globals.css)

```css
--rs-wood-dark: #2a1a0e;
--rs-wood-mid: #3d2410;
--rs-gold: #c8a96e;
--rs-gold-dim: rgba(200, 169, 110, 0.4);
--rs-text: rgba(255, 248, 235, 0.92);
--rs-text-dim: rgba(200, 169, 110, 0.5);
```

---

## raree-show-admin

**仓库**:https://github.com/yoghourt/raree-show-admin
**线上**:https://raree-show-admin.vercel.app/works
**技术栈**:Next.js 16 · TypeScript · Tailwind · shadcn/ui · Supabase · Vercel

### 已完成 PR

- PR #1:项目初始化 + Mock CRUD + Vercel
- PR #2:Supabase 数据层迁移
- PR #3:Works 管理 + 场景路由重构
- PR #4:Characters & Locations CRUD + Cloudinary + 场景表单选择器
- PR #5:Supabase Auth 登录保护
- PR #6:MapPicker(Westeros 地图点击选坐标)
- PR #7:场景列表按章节分组
- PR #8:story_images 字段 + 多图上传排序
- PR #9:story_images_v2 jsonb 引入 + 双写
- PR #10:web 切读 v2 + admin 停写 v1 + drop 旧字段
- PR #11 + #11.5:force-dynamic + modal overflow clamp
- PR #12(Day 9):场景表单 caption-first 反转 + summary 非必填 + tags UI 隐藏 + Story Sequence 英文化

---

## 数据库结构(Supabase)

### scenes 表

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 主键 |
| tsid | text | 业务 ID(scene_ 前缀) |
| title | text |  |
| summary | text | 已改为可选(PR #12) |
| order_index | integer | 场景顺序 |
| chapter_number | integer | 章节号 |
| chapter_title | text | 章节标题 |
| scene_time | text | 故事内时间 |
| story_images_v2 | jsonb | 当前唯一字段,shape: `[{url, caption}]` |
| location_id | text | 引用 locations.tsid |
| character_ids | text[] | 引用 characters.tsid |
| work_id | uuid | 引用 works.id |
| tags | text[] | UI 已隐藏,DB 字段保留待清理 |
| pov_character | text | 遗留,待清理 |
| book | integer | 遗留,待清理 |
| chapter | integer | 遗留,待清理 |

### 其他表

- `works` — tsid, title, description, cover_image
- `characters` — tsid, name, house, description, portrait_url, work_id
- `locations` — tsid, name, region, description, map_focus_x, map_focus_y, work_id

### 字段命名注意

- scenes.id 是 uuid,scenes.tsid 是业务 ID
- 前端 scene.id 实际对应 DB 的 tsid(数据层做了别名)
- SQL WHERE 子句要用 tsid,不能用 id
- works.id 是 uuid,characters/locations 用 tsid(已知设计债)

---

## 重要设计决策

- **一卷 = 一个 work**:分卷的作品建多个 work
- **chapter_number + chapter_title**:替换原 chapterInfo 字符串
- **maps 表延后**:MapPicker 硬编码 Westeros,Phase 2 实现
- **坐标系 0–1 浮点数**:与 CSS 解耦
- **window.history.replaceState**:场景切换 URL 用原生 API
- **入口调度层**:works/[workId]/page.tsx 只做 redirect
- **拉洋片装置作为视觉隐喻**:街头艺人推着木箱,观众的眼睛始终在木箱的小窗口上
- **暴露已知限制 ≥ 隐藏 polish**:PR description 主动列 follow-up
- **Schema 迁移走双字段策略**:避免原地 USING 转换的耦合风险
- **Fallback 放组件层不放数据层**:DB 存原始数据,fallback 只在渲染时发生
- **Server component 读 Supabase 必须 force-dynamic**:Next 16 默认构建时预渲染,本地 dev 不复现,只在 production build 后踩坑
- **内容语言策略:全英文单语言**(Day 9 决策)
- **Caption 校验温和模式**(PR #12):UI 层警告 + schema 不阻拦

---

## 工作流约定

- 分支:`feat/xxx` 或 `fix/xxx` → `main`
- Commit:conventional commits
- 每日最小闭环:一个工程行为 + 一次英文技术输出
- 上下文恢复:贴此文件给 Claude

### 任务边界纪律(Day 6 复盘后立)

每个 PR 开工前必须写明:

- 本次完成 = ___
- 不做清单 = ___

执行中遇到任何超出范围的想法 → 立刻转 TODO,不就地处理

四种工作模式不要混做:

1. 新功能开发(创造性,慢)
2. 视觉打磨(审美迭代,快循环)
3. bug 排查(侦探模式,慢)
4. 数据修复(运维模式,SQL + 验证)

### 跨仓库 / 跨部署纪律(Day 7 立)

- 部署顺序必须写成文档,不能临场决定
- 每段部署之间留观察窗口(10–15 分钟)
- 读切换先于写停止
- Schema DROP 留到最后

### Cursor 协作纪律

- 字段名/数据结构相关的修改,先让 Cursor 加 console.log 打印真实数据,再写代码
- 不要让 Cursor 凭印象写 select 语句或字段映射
- 复杂改动后必须验证三件事:数据流通、回归 bug、原有动效

---

## 工具与资源

- **Stack**:Next.js 16, TypeScript, Tailwind, framer-motion, Supabase, Cloudinary, Vercel, shadcn/ui
- **AI**:Gemini API(scene assistant,gemini-2.0-flash-lite 生产)、Claude(开发 + 规划 + 教练)
- **Cloudinary**:cloud name `dnuxz94n5`,unsigned preset `raree-show-admin`
- **代码工具**:Cursor、ts-node、tsid-ts(`char_` / `loc_` / `scene_` 前缀)
- **英文学习**:Duolingo 每日、Fireship YouTube、iTalki(Day 21+)
- **Live**:https://raree-show-web.vercel.app
- **Repos**:
    - https://github.com/yoghourt/raree-show-web
    - https://github.com/yoghourt/raree-show-admin
- **学习材料**:`docs/international-team-glossary.md`(Day 10 进 git,不定时回查)

---
