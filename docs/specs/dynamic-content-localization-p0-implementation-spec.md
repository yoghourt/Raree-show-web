# Dynamic Content Localization P0 — Implementation Spec

**Status:** Proposed  
**Date:** 2026-11-14  
**Repository:** raree-show-web  
**Path:** `docs/specs/dynamic-content-localization-p0-implementation-spec.md`  
**Audience:** 下一阶段实现（Cursor）  
**Evidence:** 2026-11-14 生产只读核对的结论已写入第 3 节。过程审计稿不另档保存。  
**Does not change:** ADR-002 串行检索、`match_scenes` 合同、规范英文列

本文件是实现契约。它不执行 migration，不写生产数据，不改应用代码。

归档位置是 web 仓库的 `docs/specs/`，与 W-01、ADR-003 实现说明同一目录。不放进 admin 的 `docs/specs/`：那里的 `spec-*-001` 是已接受的跨仓库能力契约（例如 SPEC-RDX-001、SPEC-VDC-001）。本文是待实现的分阶段说明，migration、阅读器投影和 AI Runtime 边界都在 web。CMS 帧写入在 admin 实现，但由本文规定，不另存一份。`market/` 不是既有文档体系，不继续使用。

词汇沿用 SPEC-VDC-001（admin `docs/specs/spec-vdc-001-vocabulary-debt-closure.md`）：数据库表 `scenes` 是 Reading Route，`story_images_v2[].caption` 是 Frame Narrative。本文保留这些列名，不重新命名。ADR-002 在 web 的 `docs/adr/002-hybrid-rag-retrieval.md`。

---

## 1. Executive Summary

P0 让读者在 `zh-CN` 下看到已有英文阅读内容的简体中文，同时让检索和场景助手继续使用英文规范列。

译文放在新表 `content_translations`。英文不复制进该表。作品、场景、人物、地点用 `tsid` 做应用层身份。帧字幕用 `frame_provenance_v1.sourceReviewId`，不用 URL、数组下标或 caption 指纹，也不往 `story_images_v2` 增加属性。

阅读器只在展示投影里替换字符串。`ReadingRoute` 上的 `title`、`summary`、`caption` 仍是规范英文，并继续进入助手请求。

CMS 必须把帧数组、Scene Context 和 provenance 放进同一次写入。新的帧 id 只用 `crypto.randomUUID()`。`sourceReviewId` 在所有作品中不得重复；这是写入不变量，不是 2026-11-14 那 33 个值已经拥有的数据库约束。同一场景上的两次保存若基于同一份旧 provenance，只有一次可以成功。换图只改 URL。无法确认身份的帧显示英文 caption。

当前可译非空字符串 165 条。`chapter_title` 保留字段，当前没有文本。两段人物 `visual` 不进入翻译范围，继续显示英文。中文由服务端脚本按作品批量调用模型生成，校验通过后即可展示。没有译文、译文过期或生成失败时，画面仍用英文。不把逐条人工录入或审核当作发布条件。

---

## 2. Goals / Non-Goals

### Goals

- `zh-CN` 时，书架、顶牌、字幕、人物卡、地点说明显示译文；没有译文时显示规范英文。
- 新增独立译文表、读取路径和 CMS 帧身份维护。
- 帧字幕的译文键在换图后保持不变，在改序、删除、拆帧、加帧后仍然指向同一帧。
- 现有英文行零更新。不触发嵌入回填。

### Non-Goals

- 不修改 `works`、`scenes`、`characters`、`locations` 的规范列。
- 不修改 `match_scenes`、`rag_text`、`rag_embedding`，不增加检索 locale 参数。
- 不把译文放进 `sceneAssistantContext` 或系统提示中的故事 XML。
- 不翻译 `summary`、`visual_convention`、`visual_identity`、`signature_quote`。
- 不翻译 Scene Context 的备用名字、`role`、`environmentFromExpression`、`visual`。
- 不建设翻译管理界面，也不在内容保存时自动翻译。那是 P1。P0 是一条可重复执行的服务端脚本。
- 不把人工逐条编写或审核当作译文上线的前提。人可以重跑脚本或日后改正一行，但不是常规门槛。
- 不把 UI 目录 `en.ts` / `zh-CN.ts` 当作动态正文的存储。

---

## 3. Production Evidence & Constraints

下列事实来自 2026-11-14 的生产只读核对，除非另标。

| 事实 | 等级 |
|---|---|
| 可见表中没有 locale、translation、alias 列或译文表 | Confirmed |
| 规范文本在 `works.title/description`、`scenes.title/chapter_title`、`story_images_v2[].caption`、`characters.name/house/description`、`locations.name/description` | Confirmed |
| 非空字符串 165。`chapter_title` 8 行全是 null | Confirmed |
| 帧 JSON 只有 `url` 和 `caption`。33/33 为带 `/v数字/` 的 Cloudinary URL，场景内和跨场景均无重复 | Confirmed |
| 33/33 帧有唯一 `sourceReviewId`，且 `frameIndex` 与数组下标一一对应 | Confirmed，这是当日快照，不是约束 |
| 人物出场 71/71、地点出场 33/33 解析到规范 `tsid`。名字与规范名无不一致 | Confirmed |
| 2 次人物出场的规范 `description` 为空，且 `visual` 非空 | Confirmed |
| `characters` 没有 alias 列。没有值为 `unknown house` 的家族。9 条 `house` 为空串 | Confirmed |
| `match_scenes` 参数为 `query_embedding`、`work_id_filter`、`candidate_tsids`、`match_count`，无 locale | Confirmed |
| 该函数的生产函数体、返回列、权限 | Unknown |
| `tsid` 唯一索引、主键以外的索引、RLS 策略 | Unknown。各表 `id uuid` 主键和外键注释来自 OpenAPI |
| 8 个场景中 4 个同时有 `rag_text` 与 `rag_embedding`，4 个两列皆 null | Confirmed |
| CMS `parseStoryImagesV2` 只保留 `url` 和 `caption`；`toUpdateRow` 不写 provenance | Confirmed in repository（`raree-show-admin`） |
| 表单上移/下移/删除只调用 `swapFramesWithContexts` / `removeFrameWithContexts` | Confirmed in repository |
| 拆帧会丢掉被拆下标的 provenance，且不为新帧分配 id | Confirmed in repository（`reindexProvenanceAfterSplit`） |
| 换图按原下标写新 URL，更新语句不包含 provenance | Confirmed in repository（`patchSceneFrameUrls`） |
| `rag_text` 仅手工回填写入，内容为标题、摘要和 caption | Confirmed in repository。线上 CMS 是否同一版本：Unknown |
| Web 阅读器使用 anon key | Confirmed in repository（`src/lib/supabase.ts`）。anon 对内容表的真实 RLS：Unknown |
| 生产 OpenAPI 的 `scenes` 列清单中没有 `updated_at` 或行版本列 | Confirmed。不能把不存在的版本列当成已有的乐观锁 |
| `updateScene`、`patchSceneOrderIndex`、`splitReadingFrame`、`updateSceneFramesAndProvenance` 的更新条件只有 `work_id` 与 `tsid` | Confirmed in repository。先查询再更新的两次往返不能单独作为并发保护 |

实现前必须再做一次只读核对（见第 9 节）。Spec 不把 Unknown 写成已经存在的约束。

`scenes.discovery_source_review_id` 是场景级来源，有局部唯一索引的仓库迁移（`idx_scenes_work_discovery_source_review`）。它不是帧身份。帧身份只在 `frame_provenance_v1[].sourceReviewId`。

---

## 4. Data Model

### 表 `public.content_translations`

英文规范列是唯一英文来源。本表只存非英文译文。P0 只允许 `zh-CN`。

```sql
create table public.content_translations (
  id uuid primary key default gen_random_uuid(),
  entity_kind text not null,
  entity_key text not null,
  field_key text not null,
  locale text not null,
  text text not null,
  source_hash text not null,
  model text not null,
  prompt_version text not null,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_translations_hash_chk
    check (source_hash ~ '^[0-9a-f]{64}$'),
  constraint content_translations_kind_chk
    check (entity_kind in ('work', 'scene', 'frame', 'character', 'location')),
  constraint content_translations_locale_chk
    check (locale in ('zh-CN')),
  constraint content_translations_text_chk
    check (length(btrim(text)) > 0),
  constraint content_translations_field_chk
    check (
      (entity_kind = 'work' and field_key in ('title', 'description'))
      or (entity_kind = 'scene' and field_key in ('title', 'chapter_title'))
      or (entity_kind = 'frame' and field_key = 'caption')
      or (entity_kind = 'character' and field_key in ('name', 'house', 'description'))
      or (entity_kind = 'location' and field_key in ('name', 'description'))
    ),
  constraint content_translations_identity_uq
    unique (entity_kind, entity_key, field_key, locale)
);

create index content_translations_lookup_idx
  on public.content_translations (locale, entity_kind, entity_key);
```

| 列 | 含义 |
|---|---|
| `entity_kind` | `work`、`scene`、`frame`、`character`、`location` |
| `entity_key` | 作品/场景/人物/地点：该行的 `tsid`。帧：`sourceReviewId` |
| `field_key` | 上表 check 中的字段名 |
| `locale` | P0 仅为 `zh-CN` |
| `text` | 去掉空白后仍非空的译文。空白不是合法行；缺失用“无行”表示 |
| `source_hash` | 生成时所用英文源字段的 SHA-256，64 位小写十六进制。不是整段提示词的哈希 |
| `model` | 实际调用的模型 id |
| `prompt_version` | 脚本里的提示词版本常量，例如 `p0-zh-cn-v1` |
| `generated_at` | 这一行最近一次校验通过并写入的时间 |

不增加 `status`。一行存在只表示曾经通过校验。是否仍可展示，由阅读器把当前英文源字段的哈希和 `source_hash` 比较。不一致就是过期，不另存状态。不增加 `reviewed`。人工审核不是 P0 的发布状态。

`source_hash` 不进入唯一约束，也不单独建索引。查找仍用 `(locale, entity_kind, entity_key)`。同一键只有一行，重复执行使用 `INSERT … ON CONFLICT` 更新，不会插入第二行。

不建指向 `works.tsid` 或其他 `tsid` 的外键。生产库尚未证实 `tsid` 唯一。帧 id 在 JSON 里，也无法做外键。应用层约定：

- 阅读器和 CMS 用 `tsid` 字符串称呼作品、场景、人物和地点。这是应用约定，不是已核实的唯一索引。
- 当日生产快照中，四张表的 `tsid` 都没有重复。这不是唯一索引。
- 若以后只读 SQL 证明 `tsid` 全局或按表唯一，可以另开 migration 加外键。P0 不加。

`entity_key` 使用 `text`。已经写在 provenance 里的 id 保持原样，不因为格式而重写。P0 之后新进入 provenance 的 id 必须是 `crypto.randomUUID()` 的返回值。`createReviewId()` 在缺少 `crypto.randomUUID` 时会退回 `rev_` 加时间戳；帧身份不得使用这条退路。没有 `randomUUID` 时，这次写入失败。

帧译文能只用 `sourceReviewId`、而不把作品 id 编进键，是因为该字符串在全部作品中最多对应一帧。译文表的唯一约束保证一个键只有一条 `zh-CN` caption。它不能发现两个场景里的同一个 id。那个不变量由第 6 节的 `frame_source_ids` 主键保证。2026-11-14 的 33 个 id 全局不重复，只说明当时的数据满足不变量，不是已存在的唯一索引。

不增加 `updated_by`。P0 没有翻译者账号。生成来源记在 `model` 与 `prompt_version`。

### 应用层身份与数据库约束

| 身份 | 应用约定 | 生产已确认的约束 |
|---|---|---|
| 作品、场景、人物、地点 | 使用 `tsid` 字符串 | `id uuid` 主键。`tsid` 非空。唯一索引 Unknown |
| 帧字幕 | 只用 `sourceReviewId`，全局最多一帧 | 快照 33 个值全局不重复。生产库没有这个唯一约束。P0 用新建的 `frame_source_ids` 主键维持 |
| 场景来源 | 不用于译文 | `discovery_source_review_id` 与帧 id 不是同一字段 |

译文表自己的唯一约束是新建的，不依赖 `tsid` 已有索引。同一 `(kind, key, field, locale)` 不能有两行。

---

## 5. Frame Identity & Provenance Invariants

### 禁止的键

- Cloudinary URL，包括去掉版本段之后的 public id。换图会替换 URL。
- `sceneTsid + frameIndex`。改序和拆帧会移动下标。
- caption 或任何内容指纹。改字幕会使键失效。
- `story_images_v2` 上的新属性。CMS 解析只留下 `url` 和 `caption`，下次保存会丢掉新属性。

### 阅读器关联

```text
当前帧下标
  → 该场景 provenance 中 frameIndex 恰好等于该下标、且 sourceReviewId 非空的唯一条目
  → entity_kind = frame, entity_key = sourceReviewId, field_key = caption
  → 译文或英文回退
```

服务器从 `frame_provenance_v1` 只抽出 `{ frameIndex, sourceReviewId }`。`rendererExpression`、`visualIntent` 和其他创作者字段不得进入客户端 props。

### 无法确认身份时

下列任一情况，该帧不查译文，显示规范 caption：

- 该下标没有条目。
- 条目的 `sourceReviewId` 为空或不是字符串。
- 同一场景里这个 `sourceReviewId` 出现多次。
- 同一场景里多个条目使用同一个 `frameIndex`。

阅读器只根据当前场景已经加载的 provenance 判断歧义。它不读取其他作品来猜测哪一帧才是这个 id 的主人。跨作品重复由写入时的主键拒绝；一旦这种行不存在，阅读器就不会遇到它。禁止用相邻下标、URL 或 caption 猜测，也禁止自动删掉重复 id。

### 一致性不变量

一次成功的结构性写入之后，必须同时成立：

1. `story_images_v2.length === provenance.length`。
2. `provenance[i].frameIndex === i`。
3. 本次写入之后，每个 `sourceReviewId` 非空，且在所有作品的 provenance 中只出现一次。同一场景内、同一作品内、跨作品的重复都拒绝，不自动保留其中一个。
4. 被保留的帧仍持有写入前的 `sourceReviewId`。
5. 新帧的 id 是这次写入在服务器上调用 `crypto.randomUUID()` 得到的。被删或被拆掉的帧，其旧 id 不再出现在任何场景。
6. 帧数组、`scene_contexts_v1`、`frame_provenance_v1` 和身份登记出现在同一个数据库语句里。不允许先写帧、再写 provenance，也不允许应用先查完全局 id 再单独更新。

Scene Context 的下标算法继续以现有函数为准：

- 交换：`swapFramesWithContexts` 的 `projectsToFrameIndex` 交换。
- 删除：`removeFrameWithContexts` 丢掉该下标，更大下标减一。
- 拆帧：`reindexContextsAfterSplit` / `shiftIndexAfterSplit`。被拆下标的 Context 按现有函数删除，后续下标后移。P0 不改变 Context 的这条语义。

provenance 使用同一次下标置换，而不是另一套加减规则。

历史行如果不是双射：阅读器按上一节回退英文。CMS 拒绝对该行做上移、下移、删除、拆帧、加帧和换图，并返回明确错误。不自动配对。2026-11-14 的 8 个场景满足双射，因此在数据未变的前提下可以编辑。实现前要重读一遍计数。

---

## 6. CMS Compatibility

仓库：`raree-show-admin`。阅读器不写 provenance。

### 共享纯函数

在 `lib/scene-context/frame-context-edit.ts` 旁增加 provenance 重排，输入输出都是内存值。不要复制一套下标算术。

建议形状：

```ts
type ProvenanceRef = {
  sourceReviewId: string
  frameIndex: number
}

function remapProvenance(
  entries: FrameProvenanceEntry[],
  mapIndex: (frameIndex: number) => number | null
): FrameProvenanceEntry[]
```

`mapIndex` 返回 `null` 表示该条目删除。存活条目保留 `rendererExpression`、`visualIntent`、`sourceContextId`，只改 `frameIndex`。

| 操作 | 帧与 Context | provenance |
|---|---|---|
| 上移 / 下移 | 继续调用 `swapFramesWithContexts` | 与 Context 相同的两下标交换 |
| 删除 | 继续调用 `removeFrameWithContexts` | 删除该下标，更大下标减一 |
| 拆帧 | 帧用 `spliceFramesAtIndex`。Context 用 `shiftIndexAfterSplit` | 见下节。不再调用会直接丢弃且不补 id 的 `reindexProvenanceAfterSplit` 作为最终结果 |
| 手工加帧 | 在数组末尾追加 `{ url: "", caption: "" }` | 服务器追加 `crypto.randomUUID()`，`frameIndex` 为新长度减一。客户端不得自造 id |
| 换图 | 只替换该下标的 `url` | id 与下标都不变 |
| 只改标题、摘要或同一下标的 caption | 帧顺序不变 | id 不变。表达式字段原样保留 |

`reindexProvenanceAfterSplit` 可以留作“丢掉被拆下标并平移其余下标”的内部步骤，但最终写入前必须在被拆位置插入 N 条新 id。旧 id 不得赋给任何一个新帧。

### 表单提交协议

`ReadingRouteForm` 今天在客户端改帧，再通过 `updateScene` → `toUpdateRow` 写入，请求里没有 provenance。服务器不能靠 URL 或 caption 判断哪一帧移动了。

新协议：与 `story_images_v2` 等长的 `frameIdentity: (string | null)[]`。

- 已有帧带上加载时的 `sourceReviewId`。
- 新帧在提交中为 `null`。服务器分配 `crypto.randomUUID()`。
- 数组顺序就是新的帧顺序。

服务器在第 6 节的同一个数据库函数里：

1. 以调用者提交的、保存前读到的 `frame_provenance_v1` 作为期望值。
2. 校验提交的非空 id 在本次数组里唯一，且每个都存在于期望 provenance 中恰好一次。客户端传来的新 id 一律拒绝，新槽必须是 `null`。
3. 提交中消失的旧 id 视为删除。
4. 每个 `null` 由该函数调用 `gen_random_uuid()`（与 `crypto.randomUUID()` 相同的 UUID）生成。不使用 `rev_` 前缀。
5. 按提交顺序写 `frameIndex = 0..n-1`，并从旧条目复制创作者字段。
6. 只更新 `story_images_v2`、`scene_contexts_v1`、`frame_provenance_v1`。不在这条语句里写标题、摘要、`order_index`、`rag_text` 或 `rag_embedding`。

客户端不提交、也不能覆盖 `rendererExpression`。

表单若同时改了标题和帧结构：先调用该函数；函数因版本不符失败时，不接着写标题。标题、摘要和标签仍由原来的 `updateScene` 写入，且该调用不得再携带 `story_images_v2` 或 provenance。这样一次帧冲突不会用旧标题覆盖新标题，帧语句本身也不会退回旧标题。标题自己的后写覆盖是既有行为，不属于帧身份。

### 旧客户端

若更新带了 `story_images_v2` 但没有 `frameIdentity`：

- 新数组与库中帧的 `(url, caption)` 按位置完全相同：允许，且不改 provenance。这是只改标题等字段的旧行为。
- 仅某些位置的 `url` 变化、caption 与长度不变：按换图处理，不改 provenance。
- 长度变化，或 caption 在下标之间发生了移动：拒绝写入。错误说明需要更新 CMS。不得写成“帧已变、provenance 未变”的行。

这个比较只用于拒绝危险写入，不是译文键。

### 其他写入点

| 路径 | 要求 |
|---|---|
| `patchSceneFrameUrls` | 保持每个下标的 id。若当前不是双射，拒绝换图 |
| `splitReadingFrame` | 在现有那条同时写三列的 `update` 中改为包含新 id。不要先写帧再补 provenance |
| `updateSceneFramesAndProvenance` | 继续作为 Discovery 接受路径。已有 `sourceReviewId` 再次接受时必须更新原帧，不得新造 id |
| `createScene` / 空路线插入 | 初始 `frame_provenance_v1` 为 `[]`。之后每加一帧分配 id |
| 手工加帧后的第一次保存 | 必须走带 `frameIdentity` 的协议 |

保存路径不得把 provenance 写成 `[]`，除非帧数组也是空的，且这次写入明确删除了全部帧。

### 调用链与执行角色

仓库里今天没有帧结构 RPC，也没有 `frame_source_ids`。下面是要新增的数据库行为，不是已经生效的触发器。

场景写入不经过 Edge Function。相关调用是 PostgREST 上的 `insert` / `update` / `delete`：

| 路径 | 客户端 | 代码里的密钥 | 数据库角色 |
|---|---|---|---|
| `ReadingRouteForm`、`FrameContextDrawer`、`BatchFrameCompletion` 调用的 `createScene`、`updateScene`、`deleteScene`、`patchSceneFrameUrls`、`patchFrameProvenanceExpression` | `raree-show-admin/lib/supabase.ts` 的浏览器 `createBrowserClient` | `NEXT_PUBLIC_SUPABASE_ANON_KEY`，并带登录 Cookie | 有会话时是 `authenticated`。这是源码能确定的客户端，不是对生产 JWT 的一次实测 |
| `splitReadingFrame`，以及把 `createSupabaseServerClient()` 传进 `updateSceneFramesAndProvenance`、`replaceSceneContextsOnly`、`deleteSceneRow` 的服务端动作 | `lib/supabase-server.ts` 的 `createServerClient` | 同上，Cookie 来自这次请求 | 同上。`splitReadingFrame` 在 `getUser()` 失败时直接返回，不写库 |
| `lib/supabase.ts` 在服务端被 import 时 | `createClient(url, anonKey)`，不读 Cookie | anon key | `anon` |
| `createSupabaseServiceClient` | service role | `SUPABASE_SERVICE_ROLE_KEY` | 绕过 RLS。注释写明只给 worker 和脚本，不放到 Vercel。场景表单不用它 |

因此 CMS 的帧保存不是 service role 路径。译文脚本使用 service role，并且只写 `content_translations`。它不更新 `story_images_v2`、`scene_contexts_v1` 或 `frame_provenance_v1`，也不调用帧结构 RPC 去改场景。触发器不得给 `authenticated` 或 `anon` 打开 `content_translations` 的写权限。

`patchFrameProvenanceExpression` 在缺少 id 时写入 ``manual_${frameIndex}``（`lib/scenes.ts` 约 L476）。这和“新 id 只由服务端 UUID 生成”冲突。P0-B 必须改掉这条，不能把它当成合法注册。

### 全局唯一与乐观并发

现有写入做不到这两件事。`lib/scenes.ts` 的 `updateScene`（约 L356–L360）和 `patchSceneOrderIndex`（约 L187–L191），以及 `splitReadingFrame`、`updateSceneFramesAndProvenance`、`replaceSceneContextsOnly`，都只按 `work_id` 和 `tsid` 更新，没有期望值谓词。生产 OpenAPI 里的 `scenes` 没有行版本列。先 `SELECT` 再无条件 `UPDATE` 不是乐观锁。现状因此不能防止后写覆盖，也不能防止跨作品重复 id。这阻塞的是 P0-B 的完成和帧字幕生成，不阻塞 P0-A 的空译文表。

### `frame_source_ids` 触发器

字段名以生产 OpenAPI 与写入代码为准，不另起名字：`scenes.work_id`、`scenes.tsid`、`scenes.story_images_v2`、`scenes.scene_contexts_v1`、`scenes.frame_provenance_v1`、`scenes.order_index`。`work_id` 在 OpenAPI 里可空。`frame_provenance_v1` 为 `jsonb NOT NULL`，默认 `[]`。`story_images_v2` 可空。

```sql
create table public.frame_source_ids (
  source_review_id text primary key,
  work_id uuid not null,
  scene_tsid text not null
);
```

一张表、一个触发器函数，绑在 `public.scenes` 上：

| 事件 | 时机 | 范围 |
|---|---|---|
| `INSERT` | `BEFORE INSERT` `FOR EACH ROW` | 每一条新场景 |
| `UPDATE` | `BEFORE UPDATE` `FOR EACH ROW` | 每一次更新。函数内部先看 `OLD` 与 `NEW`，再决定是拒绝、直接返回，还是改登记 |
| `DELETE` | `BEFORE DELETE` `FOR EACH ROW` | 每一条被删场景 |

不用 `UPDATE OF` 列清单。Postgres 的列清单只能决定触发器是否启动，不能在 `work_id` 或 `tsid` 被改写时补登记。函数自己比较新旧行：

- `OLD.work_id IS DISTINCT FROM NEW.work_id` 或 `OLD.tsid IS DISTINCT FROM NEW.tsid`：抛出 `scene_identity_immutable`，整句回滚。应用层的 `toUpdateRow` 本来就不写这两列，插入之后也没有代码改它们。P0 不实现“把登记从旧身份迁到新身份”。禁止修改是为了避免登记仍指向旧的 `work_id` + `tsid`。
- 三列与 `OLD` 都 `IS NOT DISTINCT FROM`：立刻 `RETURN NEW`。`patchSceneOrderIndex` 以及只改标题、摘要、标签的更新不重建登记。
- 三列有任一变化：先做 GUC 检查，通过后才做整组校验，并按 `OLD.work_id`、`OLD.tsid` 删除旧登记，再按 `NEW` 插入。身份列已经在上一步被拒绝，所以删除键和插入键是同一对。检查失败时还没有写登记。

三种语句不要共用一套 GUC 规则：

| `TG_OP` | expected provenance |
|---|---|
| `INSERT` | 不读 GUC。按 `NEW` 做整组校验并登记。新场景没有 `OLD` provenance |
| `UPDATE`，三列都没变 | 不读 GUC。不改登记 |
| `UPDATE`，三列有变化 | GUC `app.expected_frame_provenance` 必须存在，并且能解析成 jsonb。该值必须 `IS NOT DISTINCT FROM OLD.frame_provenance_v1`。缺失、解析失败或不相等则抛错，不删也不插登记 |
| `DELETE` | 不读 GUC。按 `OLD.work_id` 与 `OLD.tsid` 删除登记。不要求更新用的 expected 值 |

触发器每次运行都用 `NEW`（删除时用 `OLD`）同时检查三列，不能只看被 `SET` 的那一列：

- `story_images_v2` 为 null 时按空数组计。它必须是数组，元素被当成帧序列。
- `frame_provenance_v1` 必须是数组，长度与帧数组相同。
- 条目 `i` 的 `frameIndex` 必须是整数 `i`。`sourceReviewId` 必须是去空白后非空的字符串。同一数组内不得重复。
- `scene_contexts_v1` 为 null 时按空数组计。每个已解析 Context 的 `projectsToFrameIndex` 必须落在 `0 .. 帧数-1`。允许有的帧没有 Context。这与现有拆帧会丢掉被拆下标的 Context 一致。下标落在帧数组外则失败。
- 非空 provenance 要求 `NEW.work_id` 非空、`NEW.tsid` 非空。否则失败。不在触发器里补 id 或改 JSON。
- 注册行是 `(sourceReviewId, work_id, tsid)`。先删掉本场景旧登记（`work_id` + `scene_tsid`），再插入新 id。数组内重复在插入前抛错。跨场景重复由主键抛错。禁止 `ON CONFLICT DO UPDATE`，禁止跳过冲突行。
- 抛错使包含这次 `INSERT`/`UPDATE`/`DELETE` 的整个事务回滚。场景行和注册表一起回到语句之前。删除场景时先删登记；场景删除若失败，登记删除也回滚。成功删除后不得留下该 `work_id` + `tsid` 的登记。
- id 集合与登记完全相同时，可以跳过 delete/insert，但三列校验仍然执行。这避免表达式只改 `rendererExpression`、id 未变时重写同一批主键。校验失败仍然回滚。

触发器不生成 UUID，不改 caption，不改 `rag_text`。

### 直接更新不能绕过期望值检查

两边仓库的 SQL 都没有 `GRANT`、`REVOKE` 或 `CREATE POLICY`。上一轮只读也没有读到 `information_schema.role_table_grants` 或 `pg_policies`（`information_schema` 为 406，pg-meta 为 404）。所以现在不能声称 `authenticated` 有或没有 `scenes` 的表级 `UPDATE`，也不能声称存在列级 `UPDATE`。本轮不连接生产库，不把这个未知填成事实。

Postgres 的权限是叠加的，这是权限模型，不是对本库授权表的测量：表级 `UPDATE` 覆盖所有列。在表级 `UPDATE` 还在时，再 `REVOKE UPDATE (story_images_v2)` 不会去掉那一列的更新能力。要按列限制，必须先撤销表级 `UPDATE`，再把 `UPDATE` 只授给允许的列。`SECURITY INVOKER` 函数以调用者身份执行，调用者没有某列的 `UPDATE` 时，函数里的更新也会失败。

因此：

- 若表级 `UPDATE` 存在，客户端可以不调用 RPC，直接 `PATCH` 这三列。触发器仍会跑，但触发器看不到 RPC 参数里的 expected provenance。只靠“请 CMS 调用 RPC”挡不住 PostgREST。
- 单靠撤销列权限，在表级授权还在时不成立。
- 若先撤销表级授权、再只授予非帧列，`INVOKER` RPC 也写不了帧列。那时必须改用 `SECURITY DEFINER` 来写这三列。定义者若是表所有者，在没有 `FORCE ROW LEVEL SECURITY` 时会绕过 RLS。本库的 policy 和 `FORCE` 都还没读到。现在改成定义者函数会在未知的行级规则上放大写权限。P0-B 不采用这条路，也不在读到授权表之前 `REVOKE` `scenes` 的表级 `UPDATE`。那一次撤销本身会挡住标题和 `order_index` 更新，列为阻塞项，而不是默许。

P0 采用的办法不依赖那份还没读到的授权表。直接的 PostgREST `PATCH` 不会设置事务局部 GUC。帧列一变，触发器就把它和 `OLD.frame_provenance_v1` 比较；对不上就回滚，登记不动。唯一合法入口是 `SECURITY INVOKER` 函数 `public.apply_scene_frame_structure`。

不使用同一条语句里的 `visible` CTE 加 `UPDATE`。在 `READ COMMITTED` 下，语句开始时就定下快照。后提交的 `UPDATE` 会等锁，并按最新已提交行重查 `WHERE`。同一条语句里的 `SELECT` CTE 仍可能看见等待之前的旧 provenance。于是更新已经是零行，分类却还以为期望值匹配。不能靠这个快照返回 `stale_frame_structure`。

函数在调用者权限和 RLS 下分步执行，全部留在同一个事务里。`SELECT … FOR UPDATE` 在等到锁之后返回的是最新已提交版本，不是语句开始时的旧行：

1. `SELECT frame_provenance_v1 FROM public.scenes WHERE work_id = $work_id AND tsid = $scene_tsid FOR UPDATE`。看不见行就返回 `frame_write_rejected`。不说明场景是否存在，也不读取标题或 provenance 放进错误正文。
2. 锁住之后，把这一行的 provenance 与 `$expected` 比较。`IS DISTINCT FROM` 时返回 `stale_frame_structure`，不设置 GUC，不更新。CMS 必须重新加载，禁止用同一份旧 payload 再提交。
3. 相等时才 `SELECT pg_catalog.set_config('app.expected_frame_provenance', $expected::text, true)`。第三个参数把设置限制在本事务。
4. 然后更新三列。`BEFORE` 触发器看到 GUC 与 `OLD.frame_provenance_v1` 相等，才改登记。登记和场景行在同一事务里提交或一起回滚。

两个会话拿着同一份 expected 时，后一个 `FOR UPDATE` 会等到先一个提交。它读到的是新 provenance，比较失败，返回 `stale_frame_structure`，不能覆盖先提交的三列或登记。触发器抛错（重复 id、下标、身份列、GUC 缺失或与 `OLD` 不等）时，CMS 收到 `frame_structure_invariant`，不得改 id 后自动重试。

锁查询没有返回行时，不存在、`SELECT` 不可见和不能锁来更新都是 `frame_write_rejected`。不另开定义者查询去拆开这三种情况。

`service_role` 绕过 RLS，但绕过不了触发器。脚本若直接更新这三列，同样会因为没有 GUC 而失败。现有的 service role 回填若写 `scene_contexts_v1`，必须改走这个函数，或者在 P0-B 之前停用。这是兼容限制，不是授权。

标题、摘要、标签和 `order_index` 仍由原来的直接 `UPDATE` 写入，且该语句的三列与旧值相同，触发器不改登记。`replaceSceneContextsOnly` 会改 `scene_contexts_v1`，因此必须进入 `apply_scene_frame_structure`，不能留成没有期望值的直接更新。

`patchSceneOrderIndex` 只改 `order_index`。三列与旧值相同，触发器直接返回，不改登记。

### 定义者函数只登记，不写场景

触发器函数是 `SECURITY DEFINER`。场景更新函数不是。定义者函数：

- `SET search_path = pg_catalog, public`，`pg_catalog` 在前。
- 表和 `set_config` 都写全 schema。限定名不走 `search_path`，所以别人在 `public` 里新建的同名对象不会被这条函数调用。仓库没有证据表明 `anon` 或 `authenticated` 能否 `CREATE`。即便可以，限定名仍然指向 `public.frame_source_ids` 的所有者对象。
- `REVOKE ALL ON FUNCTION` 从 `PUBLIC`、`anon`、`authenticated` 撤销。没有 `EXECUTE` 就无法把它当成普通 RPC 调用。
- 函数体只删除和插入 `public.frame_source_ids`，或抛错。不出现 `public.content_translations`，也不 `UPDATE public.scenes`。
- 所有者是迁移角色，不是登录用户。它因此能写登记表，但不能被用来代替用户的场景权限。

`apply_scene_frame_structure` 不使用定义者权限。它能更新的行，不超过调用者自己的 `UPDATE` 加上 RLS 已经允许的范围。直接 `PATCH` 帧列会在触发器处回滚，所以保留表级 `UPDATE` 也不会留下成功的绕过。列级 `REVOKE` 在表级授权还在时没有效果，P0 不靠它。

已知限制：触发器落地之前，现有 `.update().eq("work_id").eq("tsid")` 仍然直接写帧。落地之后，这些语句若没有设置 GUC，会回滚。生产上 `authenticated` 是否真有表级 `UPDATE`，以及 RLS 的 `USING` / `WITH CHECK`，源码不能证明。读到授权表之前，禁止 `REVOKE UPDATE ON public.scenes`，也禁止把场景更新改成定义者函数。这两项是 P0-B 的阻塞条件，只针对“收紧授权”这条备选，不针对上面的触发器闸门。

---

## 7. Reader Localization Architecture

### 现有加载路径

`src/lib/supabase.ts` 的 anon 客户端。

| 数据 | 函数 | 页面 |
|---|---|---|
| 作品 | `getAllWorks` / `getWorkById` | `src/app/page.tsx`，场景页 |
| 场景 | `getScenesByWork` | `src/app/works/[workId]/scenes/[sceneId]/page.tsx` |
| 人物、地点 | `getAllCharacters` / `getAllLocations` | 场景页 |
| UI locale | `rs-locale` Cookie → `LocaleProvider` | 根布局。切换时不重新取作品 |

`readingRouteFromRow` 把 `story_images_v2` 收成 `{ url, caption }`，丢弃 provenance。助手上下文在 `ReadingRouteExperience` 里用这些规范字段组成 `sceneAssistantContext`。

### 新增读取

新模块 `src/lib/content-translations/`：

- `loadContentTranslations(keys)`：`locale = zh-CN`，按 `entity_kind + entity_key` 列表查询。只选 `entity_kind, entity_key, field_key, text`。
- `projectDisplayText(canonical, translated, sourceHash)`：先对当前规范字符串按第 7 节的规则计算哈希。译文经 `trim` 后非空，且哈希与 `source_hash` 相同，才用译文。否则用规范字符串。规范字符串不改写。过期行留在表里，但不展示。
- `resolveFrameSourceReviewId(entries, frameIndex)`：实现第 5 节的唯一性规则，失败返回 null。

场景页在服务端：

1. 照旧加载规范作品、场景、人物、地点。
2. 从每条场景行解析 provenance 引用，不放进 `ReadingRoute`。
3. 收集本页 `tsid` 与这些 `sourceReviewId`，加载译文。
4. 把规范 props 与一份只读字典传给客户端。字典的值只有译文，没有创作者表达式。

首页对书架上的作品 `tsid` 同样加载 `title` 和 `description`。

语言切换继续用 `useLocale()`。字典在首次渲染时已经在客户端，所以切换不必请求翻译接口，也不必为了文案再打一次数据库。若实现选择在切换时 `router.refresh()`，也仍然只读这张表，不得调用生成模型。

### 展示接入

| 表面 | 模块 | 使用的译文 | 保持规范值的地方 |
|---|---|---|---|
| 书脊、弹层标题和介绍 | `Bookshelf` | `work.title`、`work.description` | `work.id` 仍是 `tsid`，路由不变 |
| 顶牌作品名和场景名 | `ReadingRouteTimeCard` | 作品 `title`、场景 `title` | |
| 文档标题主体 | `registerPageTitle` / `readingDocumentTitle` | 与顶牌相同的显示标题 | 品牌名仍来自 UI 目录 |
| 章标题 | `CaptionDisplay` | 场景 `chapter_title`。规范值为 null 或空时不显示，与现在相同 | |
| 当前帧字幕 | `CaptionDisplay` | 帧 `caption`，键为当前下标解析出的 `sourceReviewId` | `story_images_v2[].caption` 不替换 |
| 人物名、家族、介绍 | `CharacterCardRack` | `character.name`、`house`、`description` | 见下节家族判断 |
| 地点名和介绍 | `MiniMap` 与无坐标时的地点标签 | `location.name`、`description` | 坐标、`archiveTsid` 不变 |
| 未知地点、空字幕、无介绍 | 现有 UI 目录 | 不查译文表 | 仅当规范值和译文都空时 |

不要把显示字符串写回 `ReadingRoute.title`、`summary`、`story_images_v2` 或 `sceneAssistantContext`。投影函数放在叶子组件的渲染参数上，或放在单独的 `display` 对象里。`sceneAssistantContext` 的依赖数组继续引用规范字段。

### 家族字段

`CharacterCardRack` 是否显示家族，只看规范 `house`：非空，且小写后不是 `unknown house`。显示文本才用译文。生产数据没有 `unknown house`，有 9 条空串；空串继续不显示。

### 两段 `visual`

不新增 Scene Context 译文身份，不翻译 `visual`。这 2 次出场继续走现有代码：规范 `description` 为空时显示 `appearance.visual`。它们在 `zh-CN` 下保持英文。这是明确的回退，不是遗漏。

### 规范列为空

作品和场景标题在生产中都非空。人物或地点介绍为空、且没有可用译文时，继续使用现在的“无介绍”占位。不要用英文列以外的字段填介绍，除了上面已经存在的 `visual` 回退。

### 何时算有效译文

`source_hash` 是对这一字段当前英文规范值的 SHA-256。步骤固定：Unicode NFC，去掉首尾空白，按 UTF-8 编码后哈希，写成 64 位小写十六进制。上下文、提示词和相邻字幕不进入哈希。阅读器与脚本必须用同一函数。

展示时：无行、译文空白、哈希不一致，都显示英文。过期行保留，供下次成功生成时覆盖。

### 批量生成

仓库现状：没有故事译名词典。`docs/international-team-glossary.md` 与 runtime lexicon 不提供人物译名。文本模型密钥是服务端的 `GEMINI_API_KEY`。admin 的默认文本模型是 `gemini-3.5-flash-lite`（`lib/discovery/discovery-text-llm.ts`）。web 的助手也使用该模型。service role 只在 `raree-show-admin/lib/supabase-service.ts` 和 web 的服务端脚本里出现，注释写明不要放到浏览器。

P0 因此用 `raree-show-web/scripts/translate-work.ts`，不在 Admin 里加按钮。脚本从 `.env.local` 读取 `GEMINI_API_KEY` 与 `SUPABASE_SERVICE_ROLE_KEY`。默认模型沿用 `gemini-3.5-flash-lite`，可用环境变量 `TRANSLATION_MODEL` 覆盖。实际使用的 id 写入 `model`。提示词正文放在脚本旁的常量里，版本号 `p0-zh-cn-v1` 写入 `prompt_version`。改版本号不会自动把旧译文判为过期。只有源字段哈希变化才过期。需要用新提示词重译时，显式传入 `--force`。`--force` 的结果仍须通过校验才覆盖；校验失败则保留原行。

任务按 `works.id` 取一部作品：

1. 读该作品的规范字段，以及它的场景、人物、地点和帧。空字符串不进入任务。帧没有 `sourceReviewId`，或该 id 在场景内有歧义，则跳过并写入失败报告，不猜身份。
2. 计算每条源字段的哈希。已有行且哈希相同则跳过，不调用模型。没有行，或哈希不同，才进入待译集合。
3. 调用顺序：人物与地点的姓名，再写其余非帧字段，最后按场景顺序写字幕。这样后一批可以把已经写成的姓名译文当作译名对照。操作者也可以传入一个可选 JSON 文件；文件不存在就当空对照，不报错退出。
4. 每批把稳定的 `entity_kind`、`entity_key`、`field_key` 和英文源文发给模型，要求返回同样键的 JSON 数组。字幕批次另外附上作品标题与介绍、场景标题、当前帧字幕、同一场景前后各一条英文字幕（没有则省略）、该帧 Scene Context 里已解析的人物名和地点名。这些只作为提示，不新增翻译行，也不改变 `sourceReviewId`。不把 `rendererExpression` 送进提示词。
5. 校验：可解析的 JSON；每个请求键恰好一条；`text` 去空白后非空；不返回未请求的键。源文里的 `{token}` 占位符必须原样出现在译文里。技术标识符 `tsid`、`sourceReviewId` 不作为待译字段。不合格的条目不写库。
6. 合格条目按唯一键 upsert：更新 `text`、`source_hash`、`model`、`prompt_version`、`generated_at`、`updated_at`。一条成功就提交一条，不用一个大事务包住整次模型调用。
7. 失败条目写入本次运行的 JSON 报告，包含键和原因。不写入译文表，也不删除已有行。源文已变的旧行因为哈希不符，阅读器显示英文。下次执行同一命令会再次尝试这些键。可用 `--keys` 只重试报告里的条目。

提示词约束：简体中文；不扩写、不解释；同一运行中的译名对照保持一致；只翻译给出的源文。

脚本中断后可以重跑。已成功且哈希仍相符的行会被跳过。唯一约束防止重复行。

脚本不修改英文列，不写帧三列，不调用 `apply_scene_frame_structure`，不触发嵌入回填。

---

## 8. AI Runtime & Retrieval Boundaries

不变：

- `metadataPreFiltering` → `embedQuery` → `match_scenes`。
- `match_scenes` 的参数和调用处（`src/services/retrieval.ts`）。
- `rag_text`、`rag_embedding`。不运行 `raree-show-admin` 的 `/api/admin/rag/backfill`。
- `fetchChapterScenesWithinProgress` 读出的 caption、标题。
- 故事授权哈希的输入字节，仍然是规范 caption。
- `buildAssistantSystemPrompt` 的故事 XML。
- UI locale 只继续决定现有的输出语言指令和拒绝句。它不改变检索语言，也不替换注入的英文故事。

`ReadingRouteExperience` 构建 `sceneAssistantContext` 时使用：

- 规范 `workTitle`、`title`、`chapter_title`、`summary`
- 规范解析得到的人物名和地点名

展示字典不得成为这些字段的来源。测试要断言请求体在 `zh-CN` 下仍是英文规范值。

---

## 9. Migration & RLS

### 文件

SQL 只放在 `raree-show-web/supabase/migrations/`。P0-A 一份译文表，P0-B 一份帧身份表、触发器和 RPC。不要把同一份 SQL 再复制到 admin 的 `docs/supabase/migrations/`。

应用前只读检查 `supabase_migrations.schema_migrations`（或项目实际使用的迁移表）里是否已有同名版本。过去的 SQL 有的来自 web 仓库，有的来自 admin 的 `docs/supabase/migrations`，执行通道 Unknown。

### 英文数据

P0-A 只建译文表和权限。不 `UPDATE` 内容表，不插入英文行，不改 `story_images_v2` 或 provenance。

P0-B 的迁移从现有 provenance 登记 id。它不改 caption，也不新造 id。若登记时发现重复 id 或下标不是双射，迁移中止，数据库保持迁移前的状态。

### 权限

三类机制不要混用：

| 机制 | 作用 |
|---|---|
| `GRANT` / `REVOKE` | 角色有没有这种语句的权限。没有 `GRANT` 时，即使 RLS policy 允许，语句仍然失败 |
| RLS policy | RLS 打开后，还要有一条 policy 允许该行。没有 policy 就是拒绝。表所有者和带 `BYPASSRLS` 的角色除外 |
| service role | Supabase 的 service role 绕过 RLS。它仍应走受控脚本，不把 key 放进浏览器 |

实现 migration 前，用只读 SQL 查看 `works` 的 `relrowsecurity`、`pg_policies`，以及 `anon`、`authenticated` 在 `works` 上的 `GRANT`。生产 RLS 仍是 Unknown。把查到的 policy 原文写进 P0-A 的实现说明。

译文表的目标：

- `GRANT SELECT` 给 `anon` 和 `authenticated`。
- `REVOKE INSERT, UPDATE, DELETE` 对 `anon`、`authenticated` 和 `PUBLIC`。
- 启用 RLS。
- 只创建 `SELECT` policy，不创建写 policy。这样即使某次 `GRANT` 把写权限漏回去，RLS 仍然拒绝写入。
- `SELECT` policy 的谓词与当时查到的 `works` 公开读取范围一致。`works` 若已有更窄的 `USING` 表达式，译文表复制该表达式。只有在核对记录写明 `works` 对 anon 是整表可读、且没有更窄 policy 时，才允许 `USING (true)`。不得在核对之前把 `USING (true)` 写进 migration。

`frame_source_ids` 不对 `anon` 或 `authenticated` 授予 DML。阅读器不查询它。

### 验收查询

用真实的 anon key、一个普通 `authenticated` 用户和 service role 各做一次，而不是只看 SQL 文本：

| 角色 | `SELECT` 译文表 | `INSERT` / `UPDATE` / `DELETE` 译文表 |
|---|---|---|
| `anon` | 成功，包括空表 | 失败 |
| `authenticated` | 成功，范围与 `works` 的公开读一致 | 失败。默认 grant 或遗留 policy 不得使写入成功 |
| service role | 成功 | 成功，且只出现在 P0-D 的受控脚本里 |

场景保存的执行角色见第 6 节：表单和拆帧用 anon key 加登录会话，源码上是 `authenticated`，不是 service role。生产 RLS 是否因此放行，仍要在 P0-B 前用只读方式核对，不能从客户端构造推出。

另外确认：`anon` 不能执行帧结构 RPC，也不能向 `frame_source_ids` 插入。`authenticated` 可以执行该 RPC，但 RPC 与触发器都不得对 `content_translations` 授权写入。触发器即使是 `SECURITY DEFINER`，函数体也只能读写 `frame_source_ids` 并在校验失败时抛错。

### 部署顺序

1. 应用空表 migration。此时读者尚未查询它，行为不变。
2. 应用 P0-B 的身份表、触发器和 RPC，再部署 CMS。在此之前不要生成帧字幕译文，也不要在生产里改序。
3. 部署阅读器读取与投影（P0-C）。表为空时，所有字段显示英文。
4. 对指定作品运行翻译脚本。先写非帧字段，帧字幕仍须等 P0-B 部署之后。校验通过的行立即可被阅读器使用。
5. 做第 11 节的端到端检查。

### 回滚

1. 先撤阅读器对该表的查询（旧展示路径只读规范列）。
2. 再撤 CMS 的帧结构 RPC。已经写上的新 `sourceReviewId` 可以留在 provenance 里，它们不改变英文阅读。身份表若先于 CMS 撤掉，旧的直接 `update` 会恢复，重复 id 也不再被主键挡住。所以先停用新 CMS，再 drop 触发器、函数和 `frame_source_ids`。
3. 最后才 `drop table content_translations`。先删表会使新阅读器查询失败。阅读器在表不存在时应当失败可见，不要吞掉错误后假装没有译文。回滚代码先于删表，避免这个窗口。

不回滚规范英文行，因为 P0 不修改它们。不重嵌。

### 历史 provenance

不写修复脚本去猜测缺 id 的帧。缺 id 或重复 id 的帧没有字幕译文。当日快照没有这种帧。若重读后出现，列在实现记录里，而不是自动填 id。

### 实现前只读核对

1. `works`、`scenes`、`characters`、`locations` 的重复 `tsid` 计数。
2. 帧 provenance 是否仍是 下标双射，以及 `sourceReviewId` 是否仍全局唯一。
3. `pg_get_functiondef('public.match_scenes')` 是否仍只选择 `tsid`、`title`、`similarity`。
4. `works`/`scenes` 的 RLS 与 anon `SELECT`。
5. 线上 CMS 是否包含当前的表单改序和 `patchSceneFrameUrls`。版本 Unknown。若线上没有改序入口，P0-B 仍要按本仓库源码实现，以免下次部署把缺口带上。

---

## 10. Implementation Phases

```text
P0-A 空译文表
        \
         +--> P0-C 阅读器投影（非帧字段可先验收）
        /            \
P0-B 帧身份修复 -----+--> 帧字幕投影验收
                          \
                           P0-D 先翻译非帧字段，B 完成后再翻译字幕
                                    \
                                     P0-E 端到端
```

P0-C 的代码可以在 P0-B 合并前编写，但字幕译文不得在 P0-B 部署前视为完成，也不得在那之前生成。

### P0-A — 译文表

- **模块：** `raree-show-web/supabase/migrations/<timestamp>_content_translations.sql`。
- **内容：** 第 4 节的表、check、唯一约束、查找索引、RLS 与 `SELECT` grant。无数据。
- **依赖：** 第 9 节的 RLS 只读核对。
- **验收：** 迁移可重复检查；表为空；`works`/`scenes` 行数和 `story_images_v2` 不变。第 9 节的 anon、authenticated、service role 矩阵全部通过，并且实现说明里附有当时读到的 `works` policy。
- **测试：** migration SQL 在影子库或本地库执行。用 anon key、authenticated 会话和 service role 按矩阵各执行 `SELECT` 与一次 `INSERT`。authenticated 的失败必须是权限或 RLS 拒绝，不能是应用层忘记暴露路由。
- **回滚：** 在阅读器尚未依赖该表时可以直接 drop。

### P0-B — CMS provenance

- **模块：**
  - `raree-show-web/supabase/migrations/<timestamp>_frame_source_ids.sql`（表、触发器、RPC）
  - `raree-show-admin/lib/scene-context/frame-context-edit.ts`
  - `raree-show-admin/lib/production/split-reading-frame.ts`
  - `raree-show-admin/app/actions/splitReadingFrame.ts`
  - `raree-show-admin/components/reading-routes/ReadingRouteForm.tsx`
  - `raree-show-admin/lib/scenes.ts`（`toUpdateRow`、`updateScene`、`patchSceneFrameUrls`、`patchFrameProvenanceExpression`、`deleteScene`、`createScene`）
  - `raree-show-admin/lib/rollout/scenes-server.ts` 的 `updateSceneFramesAndProvenance`、`replaceSceneContextsOnly`、`deleteSceneRow`
  - 已有 `sourceReviewId` 再次接受时必须更新原帧，不得新造 id，也不得再写 `manual_${frameIndex}`。
- **内容：** 第 6 节的协议、SQL 函数、触发器、全局主键和期望 provenance 比较。新 id 只在该函数内用 UUID 生成。
- **依赖：** P0-B 自己的 migration 先于 CMS 部署。不依赖译文表。应在生成字幕译文前完成。
- **验收：**
  - 上移、下移后，每帧 `sourceReviewId` 跟着该帧走，Context 下标与现有函数一致，表达式字段还在。
  - 删除后，被删 id 从 provenance 和 `frame_source_ids` 消失，其余 id 不变，下标连续。
  - 拆帧后，旧 id 不再出现在任何场景，每个新帧有自己的 UUID，后续帧保留原 id。
  - 加帧得到的 id 由服务器的 `gen_random_uuid()` 产生，不是客户端字符串，也不是 `rev_` 前缀。
  - 换图后 id 不变，只有 URL 变。
  - 只改场景标题不会清空 provenance。
  - 非双射或重复 id 的历史行不能被结构性保存，也不会被自动改掉。
  - 两个会话持有同一份期望 provenance 时，只有一个提交成功；失败者的场景行与身份表都不变。
  - 把另一个作品已有的 `sourceReviewId` 写入本场景时，语句失败且本场景不变。
  - 不写 `rag_text` 或 `rag_embedding`。
- **测试：** 纯函数测试覆盖交换、删除、拆帧、加帧。第 11 节第 1–8 项和第 11 项用数据库事务断言，不能只看日志。回归 `swapFramesWithContexts` 的现有 Context 测试。
- **回滚：** 恢复旧的表单保存，再按第 12 节撤下触发器和身份表。已经发出的新 UUID 留在 provenance 里是安全的。

### P0-C — 阅读器投影

- **模块：**
  - `src/lib/content-translations/`（新）
  - `src/lib/data.ts`（场景行旁解析 provenance 引用，不写入 `ReadingRoute` 的叙事字段）
  - `src/app/page.tsx`
  - `src/app/works/[workId]/scenes/[sceneId]/page.tsx`
  - `Bookshelf`、`ReadingRouteTimeCard`、`CaptionDisplay`、`CharacterCardRack`、`MiniMap`、`ReadingRouteExperience`
- **内容：** 第 7 节。助手上下文保持规范英文。
- **依赖：** P0-A 已应用。字幕验收依赖 P0-B。
- **验收：**
  - `zh-CN` 且有译文时，列出的表面显示中文。
  - 无行、空文本、哈希不一致或未知帧身份时显示英文规范值。
  - URL 仍是 `/works/{workTsid}/scenes/{sceneTsid}`。
  - `sceneAssistantContext` 在中文界面下仍是英文规范标题、摘要、caption 来源、人物名和地点名。
  - 家族是否显示由规范 `house` 决定。
  - 两段 `visual` 仍是英文。
  - 切到 `en` 后只显示规范列。
- **测试：** `projectDisplayText` 与帧 id 解析的单元测试。组件或页面夹具覆盖回退。一个助手请求夹具断言未串入译文。
- **回滚：** 移除字典查询，组件直接渲染规范 props。

### P0-D — 按作品批量生成简体中文

- **模块：** `raree-show-web/scripts/translate-work.ts`。用现有 `tsx` 方式运行，例如 `tsx scripts/translate-work.ts --work-id <works.id uuid>`。不新增队列，不在浏览器里暴露路由。Admin 按钮和保存后自动翻译留到 P1。
- **内容：** 第 7 节的任务。范围仍是第 4 节的字段。空章标题、空介绍、空家族不调用模型。不翻译 `visual`。帧字幕仅在 P0-B 部署之后，按当时的 `sourceReviewId` 生成。
- **依赖：** P0-A。帧行还依赖 P0-B。字段清单以运行当时的非空规范值为准，不用本文的 165 代替再数一次。
- **验收：** 同一命令重跑不增加行数；哈希相同的行不重复调用模型；失败条目写在本次运行的 JSON 报告里，已成功的行仍在；`story_images_v2` 与 `rag_embedding` 非空数量不变。
- **测试：** 用假的模型响应测校验、upsert 和失败不覆盖。干跑模式只打印待译条数，不写库、不调用模型。
- **回滚：** `delete from content_translations where locale = 'zh-CN'`。规范列不变。

P1 才做：CMS 保存后自动跑任务、任务进度界面、独立术语库和质量抽检。P0 不为此加任务表。

### P0-E — 端到端与回归

- **依赖：** A、B、C 已部署；D 至少完成要验收的那一类字段。
- **验收与测试：** 第 11 节。
- **回滚：** 按第 9 节的顺序，先代码后表。

---

## 11. Testing & Acceptance Criteria

阅读器：

- 中文界面下，作品标题、介绍、场景标题、当前字幕、人物名、家族、人物介绍、地点名、地点介绍在哈希相符的译文存在时为中文。
- 删除某一译文行，或把它的 `source_hash` 改成与当前英文不符，该字段回到英文，其余字段仍为中文。
- 假模型返回缺键、空字符串或坏 JSON 时，对应旧行不变。哈希相同的第二次运行不调用模型。
- 章标题仍为空时不出现空白章名。
- 场景切换和帧切换使用原来的 `tsid` 与下标。下标只选择帧，不作为译文键。
- 助手面板的下一次请求体不含中文规范替换。检索测试不修改即可通过。

数据库测试必须在事务里断言回滚后的行，不能只看日志。至少覆盖：

1. `INSERT` 带合法 provenance 的场景后，`frame_source_ids` 含有这些 `sourceReviewId`，且 `work_id`、`scene_tsid` 等于该行。
2. `UPDATE` 帧结构后，旧 id 从注册表消失，新 id 出现，场景三列与注册表同时变成新值。
3. `DELETE` 场景后，该 `work_id` + `tsid` 的注册行数为 0。
4. 只 `UPDATE order_index` 或只改 `title` 时，`frame_source_ids` 的行集合与更新前相同。把 `work_id` 或 `tsid` 改成新值时语句失败，登记仍指向原来的身份。
5. 三列不一致（provenance 长度、`frameIndex` 或 Context 下标越界）时语句失败，场景三列和注册表都与失败前相同。
6. 使用另一场景已注册的 `sourceReviewId` 时语句失败，发起更新的场景和注册表都不变。不得只跳过冲突 id。
7. 两个真实并发事务以同一 `expected` provenance 调用 `apply_scene_frame_structure`。先提交者成功。后提交者的 `SELECT … FOR UPDATE` 必须看到先提交者的 provenance，并返回 `stale_frame_structure`。后提交者不得覆盖先提交者的三列或 `frame_source_ids`。
8. 不设置 GUC 的直接帧列 `UPDATE` 失败。RPC 传入缺失、无法解析成 jsonb、或与 `OLD.frame_provenance_v1` 不一致的 GUC 时失败。`INSERT` 新场景和 `DELETE` 场景不因为没有 UPDATE 用的 expected 值而失败。对调用者不可见的 `work_id` + `tsid` 返回 `frame_write_rejected`，响应正文不包含该场景的标题或 provenance。上述任一失败结束后，场景行与 `frame_source_ids` 和失败前一致，或与先提交者的结果一致，不能停在中间状态。
9. 在 RLS 下，`anon` 与 `authenticated` 对 `content_translations` 的 `INSERT`、`UPDATE`、`DELETE` 失败，`SELECT` 成功。
10. 翻译脚本只用服务端的 `GEMINI_API_KEY` 和 `SUPABASE_SERVICE_ROLE_KEY`。浏览器包里没有这两把密钥。脚本可以 upsert 一条译文，anon 与 authenticated 不能写译文表。
11. 迁移回填遇到重复 `sourceReviewId` 时整次迁移失败，不插入“选中的”那一条，也不改原 provenance。

CMS 行为测试：

- 对一个含三帧、三份不同 `sourceReviewId` 的夹具执行上移、下移、删除、拆成两帧、末尾加帧、替换中间帧 URL。
- 每次操作后读取数据库：三列与 `frame_source_ids` 满足第 5 节不变量，创作者表达式仍在未被拆掉的帧上。新 id 是 UUID，不是 `rev_` 或 `manual_` 前缀。
- 旧的“只提交帧数组且 caption 换了位置”的请求被拒绝，provenance 与帧数组保持操作前的值。
- 过期写返回 `stale_frame_structure`。不变量失败返回 `frame_structure_invariant`。

权限：

- 按第 9 节矩阵执行。`USING (true)` 只有在 `works` 的核对记录支持时才出现在已应用的 policy 里。触发器函数的 `proacl` 与 `prosecdef` 需要断言：它不能成为 `content_translations` 的写入口。

数据：

- migration 前后 `scenes`、`works`、`characters`、`locations` 的规范列校验和或行数一致。P0 不需要哈希整表正文；至少断言这些表的 `count(*)` 不变，且抽查一行英文标题未变。
- `rag_embedding is not null` 的场景数不变。

---

## 12. Rollback Strategy

| 阶段 | 回滚 |
|---|---|
| 只建了空译文表 | drop `content_translations` |
| 已建身份表但 CMS 未改帧 | drop 触发器、RPC 和 `frame_source_ids`。provenance 未被改过 |
| CMS 已部署但未改序 | 部署上一版 CMS，再撤身份表。新 id 若已写入 provenance，保留 |
| 阅读器已部署，表空或已有译文 | 先部署不查询译文表的阅读器。界面回到全英文 |
| 译文已生成 | 删除 `locale = zh-CN` 的行，或在阅读器回滚之后 drop 表。英文列不参与回滚 |
| 任何阶段 | 不恢复嵌入，不改英文列，不改 `match_scenes` |

禁止的窗口：新阅读器仍在查询时 drop 表。

---

## 13. Risks & Unresolved Questions

| 项 | 处理 |
|---|---|
| `tsid` 没有已证实的唯一索引 | 译文表不用外键。生成前重数重复 `tsid`。有重复则停止该实体 |
| 快照里的全局唯一不是约束 | 不把 33 这个数字写成索引。新的主键从迁移回填开始执行。回填撞上重复则停止，不修复 |
| 表级 `UPDATE` 是否存在尚未测量 | 不把列级 `REVOKE` 当成已经能堵住直接 `PATCH`。触发器闸门不依赖这次测量。测量完成前不 `REVOKE` 场景表的 `UPDATE`，也不把场景写入改成定义者函数 |
| 旧 CMS 在触发器落地前仍可直接覆盖帧 | 落地后没有 GUC 的直接更新会回滚。上线前停用仍直接写三列的脚本 |
| `match_scenes` 函数体 Unknown | 不改函数，不加 `scenes` 列。身份表和译文表都不是 `scenes` 的列 |
| 线上 CMS 版本 Unknown | P0-B 按 admin 源码替换全部列出的写入点，并在部署笔记里记录线上版本 |
| `works` 的 RLS 尚未查看 | 不在 Spec 里预定 `USING (true)`。P0-A 先记录 policy，再写与之相同的 `SELECT` 谓词 |
| `scenes` 更新是否真由 `authenticated` 放行 | 源码只证明客户端用 anon key 加登录 Cookie。P0-B 前用只读方式核对生产 policy。不因此改用 service role 写帧 |
| `patchFrameProvenanceExpression` 会写 `manual_${frameIndex}` | 已在 admin 源码中。P0-B 删除该格式。触发器不接受用它自动补 id |
| 改序与 provenance 今日可能仍不一致，若有人在核对之后用旧 CMS 改过帧 | 实现前重跑双射计数。不一致则该场景字幕回退英文，CMS 拒绝继续改结构 |
| 两段英文 `visual` | 接受英文回退。不扩大模型 |
| `authenticated` 的默认表权限可能比预想更宽 | 验收同时看 `GRANT` 和 RLS。只测 anon 不够 |
| 英文原文改变后旧译文仍在表里 | 阅读器比较 `source_hash`。不一致就显示英文。重跑脚本成功后才覆盖。失败不删除旧行，但旧行已不能展示 |
| 仓库没有故事译名词典 | `docs/international-team-glossary.md` 和 runtime lexicon 不是人物译名表。P0 只用同一次运行里先写成的姓名译文，以及操作者显式传入的可选文件。不假设文件已经存在 |
| 模型质量没有人工逐条审核 | P0 接受这个风险。校验失败的条目不写入。不为此增加审核状态 |
| `chapter_title` 以后被填上 | 字段已在 check 约束中。有规范值且没有译文时显示英文 |

没有未决问题会改变“独立表 + `sourceReviewId` + 展示投影”这一结构。未决项只影响权限语句的最终谓词，以及生成前要停下来的数据检查。翻译生产方式改为服务端批量生成，不改变独立表、`sourceReviewId` 和展示投影。
