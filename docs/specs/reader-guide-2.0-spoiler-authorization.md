# Reader Guide 2.0：知识补充与用户控制的剧透授权

**Status:** Frozen  
**Date:** 2026-11-17  
**Reviewed:** 2026-11-17  
**Repository:** raree-show-web  
**Path:** `docs/specs/reader-guide-2.0-spoiler-authorization.md`  
**Audience:** 后续实现（Cursor）  
**Evidence:** 2026-11-17 对照当前仓库，并对生产库做了只读核对。审查修订只改本文，没有写库，也没有改应用代码。  
**Does not change in this document:** 不修改 ADR 正文，不修改应用、CMS、SQL、RPC、Migration 或 Prompt 源码。

本文是 Reader Guide 2.0 的实现契约。仓库里没有一份现成的助手产品规格可以承载这次改动。`docs/adr/002-hybrid-rag-retrieval.md` 管的是串行检索和默认可见性，`docs/specs/ADR-002-VISIBILITY-INVARIANT-SPEC.md` 管的是未授权故事片段不得进入模型上下文。把整份产品方案写进这两份文件，会把「默认进度边界」和「用户明确授权后的作品范围」混成同一条规则。因此新增本文，不另写第二份方案。

2026-11-17 审查后，本文冻结为实现契约。P0 已实施。第 16 节已写入 ADR-002 Amendment A。P1 已按第 6–9 节编码：授权卡、两条检索路径、结尾标记、`assistant-turn-seal` 和 HMAC。服务端环境变量 `ASSISTANT_TURN_SEAL_KEY` 必须配置，且各实例使用同一密钥；缺失时 `/api/scene-assistant` 返回配置错误。P2 尚未开始。

审查确定的四点：

1. 情况 C 的逻辑结果可以同时有安全回答和授权请求。线上格式不是把这个 JSON 流给浏览器。
2. 无剧透路径按 `metadataPreFiltering` 的候选 `tsid` 读取已读 caption。`match_scenes` 只负责排序，空嵌入不再挡住历史 caption。
3. 服务端用 HMAC 封印助手回合。它能挡住改过标记或改过正文的助手消息，不能挡住用户自己写下的剧透。
4. Production story oracle 继续只覆盖实际注入的 caption。summary 和人物卡不进入这个哈希。

动态内容本地化规格明确不把译文放进助手。本文不推翻该决定。

---

## 1. 产品定位

Raree Show 的阅读向导要为读者补上场景没有展开的细节、背景、人物和情节分析。CMS 是作品上下文和优先依据，不是模型知识的全部边界。

两个维度分开判断。

| 维度 | 含义 | 谁来决定 |
|---|---|---|
| 内容可见性 | 当前阅读进度之内，还是进度之外 | 默认停在进度内。只有用户明确授权，服务端才把当前作品已入库的后续内容放进上下文 |
| 知识来源 | CMS 已录入的作品内容，还是模型自身的作品与背景知识 | CMS 中的明确事实优先。CMS 没有写到的部分，允许模型用自身知识补充，并说明这不是 Raree 正文 |

无剧透不等于禁止使用模型知识。场景没有画出某个细节，也不等于这个细节是剧透。

无剧透模式下仍然可以直接回答：

- 当前场景已经涉及的人物和事件。
- 不暴露未读情节的历史、文化、地理和社会背景。
- 对已读情节的解释。
- 画面没有直接写出、但讲出来也不会揭示进度之外情节的信息。

只有一份完整回答会揭示当前进度之外的情节或信息时，才暂停并请求授权。检索为空、CMS 没有写到、问题超出助手范围、检索或模型调用失败，都不是这一条。

模型权重里的后续情节无法用物理截断删除。物理边界只保证未授权的 CMS 故事片段不进入上下文。无剧透模式仍要在提示词里禁止主动讲述未读情节。这是行为约束，不是新的物理隔离。

---

## 2. 当前执行链路

一次提问的实际路径如下。

```text
ReadingRouteExperience
  canonicalSceneAssistantContext + sceneAssistantUserProgress
    → ReadingRouteAssistant.send
      → historyTurnsForRequest
      → POST /api/scene-assistant
        → retrieveVerifiedAssistantContext
            Branch A: metadataPreFiltering → embedQuery → match_scenes → 去掉当前 sceneTsid → 回表补 summary
            Branch B: fetchChapterScenesWithinProgress → 按帧截断 caption
            → production story oracle（只哈希 Branch B 的 caption）
        → buildContextXml（语义结果的 summary）
        → composeAssistantSystemPrompt → buildAssistantSystemPrompt
        → executeVerifiedGeneration
            Gemini gemini-3.5-flash-lite，失败且尚未输出正文时才尝试 OpenRouter
        → UI Message SSE text-delta
      → ReadingRouteAssistant 用 ReactMarkdown 追加到同一条助手消息
```

`ReadingRouteAssistant` 的开关只改 `open`。对话数组留在该组件的内存状态里。关闭面板不卸载组件，因此不结束对话。

`ReadingRouteExperience` 把助手挂成 `key={visualReadingRoute.tsid}`。切换阅读路线会卸载并重建助手，内存中的对话消失。同一路线内换帧不会重建。页面刷新会重建。现在没有「新对话」按钮，也没有 localStorage、Cookie 或账户级持久化。

### 2.1 阅读进度字段

助手请求里的进度是 `ReadingRouteAssistantUserProgress`，由当前画面在渲染时算出。

| 请求字段 | 当前来源 | 作用 |
|---|---|---|
| `workTsid` | 页面的 `work.id`。`workFromRow` 把 `works.tsid` 放进 `Work.id` | 服务端再用它查出 `works.id` UUID |
| `readUpToChapter` | 当前路线的 `chapter_number` | Layer 1 的章上界 |
| `readUpToOrderIndex` | `order_index`，缺省时用 `order`。二者都来自 `scenes.order_index` | Layer 1 在同一章内的顺序上界 |
| `sceneTsid` | `scenes.tsid` | 当前路线。必须和 `sceneContext.tsid` 相同 |
| `readUpToStoryIndexLast` | 有效帧数为 0 时为 `-1`，否则为当前 `imageIndex` | 只截断当前路线的 caption |

画面上的「第几条路线」是 `allReadingRoutes` 的数组下标，只给字幕区显示，不进入助手请求。

`loadScenesByWork` 按 `chapter_number`、`order_index` 排序。Layer 1 的过滤是：

```text
chapter_number < readUpToChapter
或 (chapter_number = readUpToChapter 且 order_index <= readUpToOrderIndex)
```

这是章号加路线顺序，不是帧下标，也不是数组下标。

服务端没有单独的阅读账本。进度完全由这次请求的客户端字段声明。`assertReadUpToStoryIndexLast` 只拒绝非整数和小于 `-1` 的帧下标；帧下标超过实际帧数时，Branch B 会夹到最后一帧。把章号或 `order_index` 改大，今天就会扩大 Layer 1。这是既有信任边界，不是剧透开关。

### 2.2 Layer 1 与 Layer 2 如何配合

两条输入在 `retrieveVerifiedAssistantContext` 里并行读取，然后汇合。这不是第二次语义检索。

Branch A，`metadataPreFiltering` 然后 `match_scenes`：

- 候选集是当前作品里、进度上界以内的路线 `tsid`。
- `match_scenes` 只在这个候选集上按向量重排，默认 10 条。
- 返回列经 2026-11-17 调用核对为 `tsid`、`title`、`similarity`。函数体 SQL 没有读出，行为见第 2.6 节。
- 当前路线从结果里去掉，避免整段 RAG 文本绕过帧截断。
- `mergeScenesTableSummaries` 再按 `tsid` 读取 `scenes.summary`。摘要不参与 story oracle。

Branch B，`fetchChapterScenesWithinProgress`：

- 只读取与 `sceneContext.chapter_number` 相同、且 `order_index <= readUpToOrderIndex` 的路线。
- 更早的路线注入全部有效帧 caption。
- 当前路线只注入 `0..readUpToStoryIndexLast`。
- 同一章、同一 `order_index`、但不是当前 `sceneTsid` 的路线，caption 被置空。
- 更早章节的 caption 不会因为 Branch B 进入提示词。它们只能通过 Branch A 的摘要间接出现。

当前路线的 `summary`、标题、地点和人物名来自客户端 `sceneContext`，不按帧截断。ADR-002 把这些字段排除在「narrative atom」之外。

2026-11-17 的数据里，《权力的游戏》第 2 章有两条路线，`order_index` 都是 0。按现行规则，非当前那一条的 caption 不会注入，但它有 embedding，语义检索仍可能把它的整段 summary 放进 `<context>`。这是既有边界，本方案不顺便改排序规则。

### 2.3 当前场景摘要、caption、人物资料

| 材料 | 字段 | 是否按帧截断 | 是否进入助手 |
|---|---|---|---|
| 当前帧字幕 | `story_images_v2[].caption`，经 Branch B | 是 | 是，英文规范列 |
| 当前路线摘要 | `scenes.summary`，经客户端 `sceneContext.summary` | 否 | 是 |
| 其他已读路线摘要 | `scenes.summary`，经 Branch A 回表 | 否，只受路线进度约束 | 语义命中时是 |
| 人物名 | 当前帧 Scene Context 解析出的 `name` | 随当前帧变化 | 只传名字 |
| 人物介绍 | `characters.description`，缺介绍时界面可回退 `visual` | 不适用 | 否 |
| 地点名 | 当前帧地点显示名 | 随当前帧变化 | 只传名字 |
| 地点介绍 | `locations.description` | 不适用 | 否 |
| 中文译文 | `content_translations` | 不适用 | 否 |

`canonicalSceneAssistantContext` 的注释写明助手上下文只取英文规范字段。阅读页把中文用于字幕、人物卡和地点说明，不用于 `sceneAssistantContext`。Branch B 直接读 `story_images_v2`，不读译文表。

人物卡已经能解析出 `description`。`ReadingRouteExperience` 给助手的是 `presentCharacters.map((person) => person.name)`。

### 2.4 提示词实际禁止什么

系统提示词的主体在 `buildAssistantSystemPrompt`，语言是英文。`zh-CN` 只替换拒答句，并在末尾追加中文输出要求。

和本任务直接相关的现行规则：

- 已读范围内，预训练知识只许用于语气和衔接。
- 画面上已出现实体的名字、数量、外貌，caption 单薄时可以用与来源一致的常识，并且必须回答。
- 已读故事时间之内的事件，caption 简短时可以做有限复述，事实仍须来自注入的 XML。
- 只有在已读材料、推断和画面识别都无法回答，而且完整回答必然需要未读故事时，才逐字输出拒答句。
- 回答最多两句。

拒答句：

- 中文：`就你目前读到的进度而言，这部分还没有揭晓。`
- 英文：`Based on your progress so far, that information has not been revealed yet.`

它不是服务端对所有失败的统一返回值。检索异常在 `route.ts` 里变成 HTTP 500 或 502。生成失败由 `executeVerifiedGeneration` 返回另一段英文错误。前端用 `localizeKnownError` 显示错误条。空的 `<context>` 不会短路，请求仍会生成。

因此，检索为空、CMS 没有细节、模型认为后续剧情不能讲，这三件事今天会进入同一次生成。模型被要求在「XML 里没有足够事实」时使用那句拒答。过度拒答发生在提示词，不发生在一个共用的拒答函数里。

### 2.5 对话历史与前端消息

`AssistantChatMessage` 只有 `role`、`content`、`generationId`、`status`。`historyTurnsForRequest` 去掉仍在流式中的助手消息，把其余消息收成 `{ role, content }`。已取消但留有文字的助手消息会进入下一轮。测试已锁定这个行为。

服务端相信客户端送来的 `messages`，不按剧透标记过滤。前端把助手内容交给 `ReactMarkdown`。没有消息种类、按钮或授权卡片。

### 2.6 2026-11-17 只读数据

生产库当时有 4 部作品、8 条路线。

| 作品 | `works.tsid` | 路线 | `rag_embedding` | `rag_text` |
|---|---|---|---|---|
| Game of Thrones | `work_asoiaf` | 4 | 4 条都有 | 4 条都有 |
| Romance of the Three Kingdoms | `work_1786961407363` | 4 | 全部为空 | 全部为空 |
| The Three-Body Problem | `work_1775348657043` | 0 | 无 | 无 |
| Harry Potter and the Philosopher's Stone | `work_1775780178501` | 0 | 无 | 无 |

`content_translations` 有 164 行 `zh-CN`：人物 97、帧 33、地点 22、场景 8、作品 4。这些行服务于展示。助手链路不读取它们。

用 768 维零向量调用现有 `match_scenes`：

- 《三国演义》四条路线作为候选：返回 0 行。
- 《权力的游戏》四条路线作为候选：返回 4 行，列是 `tsid`、`title`、`similarity`。
- 候选为空：返回 0 行，不报错。
- 用《三国演义》的 `work_id` 配上《权力的游戏》的 `tsid`：返回 0 行。

函数体文本仍未读取。上面是调用行为，不是函数源码。空 embedding 不会让整个请求失败；它让 Branch A 没有语义补充。Branch B 不看 embedding，同章已读 caption 仍会注入。

《三国演义》人物卡使用罗马字 Zhang Jue，不是 Zhang Jiao。第一条路线第 0 帧的出场人物只有 Zhang Jue。他的介绍是一句起义领袖说明，没有太平道、信众或发家过程。Liu Bei、Guan Yu、Zhang Fei 的介绍分别是出身与双剑、偃月刀、富商出身的将领和丈八蛇矛。三条介绍都没有写结义前的具体营生，也不进入助手。

第一条路线第 0 帧 caption 写的是腐败与灾异引发 Zhang Jue 领导的黄巾起义，以及招募。随后几帧才出现三人、桃园结义和作战。四条路线的 caption 与 summary 都没有太平道传教、组织信众或三人结义前营生。第一条 summary 会整段进入提示词，关键词上写了黄巾与招募，没有桃园。不能据此断言 summary 永远不含后续帧细节；代码路径确定它不做帧截断。

《三体》和《哈利·波特》没有路线。已入库的《三国演义》只有开篇四条路线，不是整部小说。

---

## 3. 与目标体验的差距

| 目标 | 当前实现 |
|---|---|
| CMS 不足时用模型知识补充非剧透背景 | 提示词要求事实来自 XML，预训练只用于润色和很窄的画面识别 |
| 场景未展示不等于剧透 | 材料不足和未读情节共用一句「尚未揭晓」 |
| 检索为空仍可回答 | 请求不会失败，但空上下文会把模型推向那句拒答 |
| 技术失败单独说明 | HTTP 错误已经分开。模型自己说「尚未揭晓」时，用户无法分辨 |
| 用户决定是否越过阅读边界 | 没有授权状态、按钮或第二次请求 |
| 授权后读取当前作品已入库的后续内容 | Layer 1 只有进度上界。空 embedding 的路线不会出现在 `match_scenes` |
| 授权后模型补充未入库情节 | 提示词禁止把预训练当事实 |
| 单次授权不继承，会话授权由用户开关 | 不存在这两种状态 |
| 剧透回答留在界面里，但不进入之后的无剧透上下文 | 历史只保留角色和正文，下一轮全部送回 |
| 人物卡参与判断 | 只有当前帧人名。Zhang Jue 的介绍即使在第 0 帧也不会进入提示词 |
| 中文读者看到的正文就是模型证据 | 读者看译文，模型看英文规范列。本方案保持这个边界 |
| 回答可以展开背景 | 提示词限制最多两句 |

---

## 4. 回答策略

默认模式是 `no_spoiler`。废除「尚未揭晓」作为通用兜底。P0 从提示词和 locale 中移除「只能逐字回复这句」的指令。`closedDomainRefusal` 不再进入系统提示词。

### 情况 A：当前阅读范围可以回答

直接回答。可以使用已注入的 CMS 文本，也可以使用不会揭示未读情节的模型知识。

### 情况 B：当前场景没有展示细节，但不需要越过阅读边界

直接补充。当前人物的背景、已经发生事件的原因、文化背景属于这里。不为这种情况发授权卡。

《三国演义》第 0 帧已经出现黄巾起义和 Zhang Jue。补充太平道和起事组织方式属于情况 B，因为四条已入库路线都没有把这段写成后续剧情，而它解释的是已经可见的事件。回答不得继续讲他的败亡，也不得讲读者尚未看到的三人经历。

### 情况 C：完整回答会越过当前阅读边界

逻辑结果是下面两种之一。`safeAnswer` 可以为空。`questionId` 不属于模型输出。

```ts
type AssistantResponse =
  | { type: "answer"; content: string }
  | { type: "spoiler_authorization_request"; safeAnswer: string }
```

安全部分先说完。越过进度的部分不写进 `safeAnswer`。P1 在同一条助手消息下显示授权卡，不结束对话，也不要求用户重输问题。线上字节格式见第 6.1 节，不把这个对象当作 `text-delta` 流给浏览器。

P0 还没有按钮，也不解释结尾标记。P0 的情况 C 只在安全部分之后追加一句固定边界说明：

- 中文：`要把这件事讲完整，会越过你目前读到的进度。`
- 英文：`A complete answer would go beyond the point you have reached.`

已有安全部分时，这句放在回答末尾，不能代替安全部分。P1 用第 6.1 节的结尾标记代替这句说明，不再把这句当作按钮的替代品。

### 情况 D：检索或生成失败

继续使用现有 HTTP 错误和错误条。模型提示词不得把数据库、embedding、供应商或网络异常说成情节尚未揭晓。空的 `match_scenes` 结果不是失败。

### 情况 E：超出作品和场景助手的范围

用一两句说明助手回答的是当前作品和正在阅读的场景。不发授权卡。

- 中文：`我只能顺着这部作品和你正在看的场景来聊。这个问题超出这个范围了。`
- 英文：`I can help with this work and the scene you are reading. That question is outside that range.`

---

## 5. 知识补充的生成规则

两种模式共用这些规则。

1. CMS 注入文本里的明确事实优先于模型记忆。冲突时，先说场景或人物卡里的说法，再单独说明小说、史书或改编中的不同说法。
2. CMS 没有写到，不代表作品没有这件事，也不代表可以拒答。
3. 模型知识必须能被读者听出来是补充，而不是 Raree 正文。用自然句子区分，不在每条回答下列来源清单。
4. 小说情节、史书记载、民间故事和影视改编分开说。当前作品标题是判断哪一套叙事为主的依据。
5. 不能确定的细节说明不确定，给出有限解释。不编造具体对话、经历或事件。
6. 不因为 `<context>` 为空、caption 短或人物介绍缺失而拒答。
7. 读者可能使用中文通名，证据里可能是另一种罗马字。Zhang Jue 与「张角」视为同一人，不把名字不一致当成资料缺失。
8. 注入的路线是 Raree 已经录入的摘录，不是整部小说已经入库的证明。

无剧透模式额外要求：

- 可以解释已出现的人物、已发生事件的背景和原因。
- 不得主动讲述当前 caption 上界之后的情节、结局、身份揭示或未来关系。
- 判断剧透时看的是未读情节，不是「CMS 有没有这一句」。

剧透模式额外要求：

- 可以使用本次注入的全部已入库作品文本。
- 可以补充 CMS 没有录入的相关作品知识，包括进度之外的情节。
- 仍然不得串到其他作品。
- 回答开头用一句短标记说明其中含有尚未读到的内容。界面徽章是权威标记，不依赖模型记得加标记。

P0 删除「最多两句」。替换为：通常一段即可；用户询问过程、比较或数个人物时可以稍长；不写成长篇来源报告。

P0 和 P1 都不把 `content_translations` 注入助手。中文输出仍由现有的输出语言段负责。

人物介绍：

- 无剧透路径不新增人物介绍。它们不按帧截断，而且 Zhang Fei 的「富商」与通行小说营生可能不一致。
- 剧透路径只附加当前帧已经出场、且能在当前作品中按 `tsid` 找到的人物介绍。提示词标明这是人物卡，不是场景正文。
- 第 0 帧只有 Zhang Jue。他的介绍回答不了发家过程。不为此新增人名检索或实体链接。

---

## 6. 授权交互

会话只有两种持久状态：`no_spoiler` 和 `conversation_spoiler`。`single_request` 只存在于被授权的那一次请求上，不写入会话状态。

状态放在 `ReadingRouteAssistant` 内部，和 `messages` 放在一起。不放到父组件，不写入浏览器存储或数据库。路线 `key` 已经会在切换路线时清空它。

### 6.1 授权卡与流式契约

当前生成链路不适合把第 4 节的 JSON 对象直接流给浏览器。

`executeVerifiedGeneration` 调用 `provider.streamText`，再把 AI SDK 的 UI Message SSE 交给客户端。`orchestrateProviderStream` 在第一个 `text-delta` 之前可以换供应商；一旦出现第一个正文分块，语义锁就固定，之后不能换供应商。客户端的 `parseUiMessageSseEvent` 只把 `text-delta` 拼进一条字符串，再用 `ReactMarkdown` 渲染。语义流守卫会放过它不认识的事件类型，但不会替客户端解释 JSON。

因此：

- 若每个回答都是完整 JSON，普通回答也要等对象闭合后才能显示，现有逐字流出会停掉。
- JSON 字符串被分块切开时，转义和引号没有可靠的增量解析。
- 第一个字符 `{` 就会锁住供应商。生成中断后不能再靠 fallback 补一份正确 JSON。
- 中断会在消息里留下半段 JSON。把它交给 Markdown 就是不可操作的错误文本。
- 安全回答和授权卡挤在同一个 JSON 字符串里，无法一边流式显示散文，一边等卡片。

P1 不采用 Gemini JSON mode，也不把判别联合对象放进 `text-delta`。逻辑结果仍是第 4 节的两种类型。线上分成散文和一条服务端事件。

模型在情况 C 的正文结束后，另起一行写出恰好这个标记，标记之后不能再有文字：

```text
<<RAREE_SPOILER_REQUEST>>
```

安全回答为空时，模型只输出这一行。模型不输出 JSON，不写按钮文案，不生成 `questionId`。P1 提示词要求用这个标记，不再用 P0 的边界句代替卡片。

服务端在语义锁之后的字节流上做一层剥离，不改变 ADR-003 的供应商切换：

1. 继续立刻转发已经确定不属于标记的 `text-delta`。
2. 最多暂扣标记长度的尾部。标记被切进多个分块时，尾部留在服务端，不进入 Markdown。
3. 流正常结束时都发出第 7 节的 `assistant-turn-seal`。全文以该标记结尾时先丢掉标记，并把 `spoilerAuthorizationRequest` 设为 true；否则设为 false。`spoilerDisclosure` 只看本轮是否走了剧透检索，不看标记。
4. 流被中止、出错或在语义锁之前失败时，不发 seal，也不发授权卡。暂扣内容若只是标记的前缀，就丢弃这段前缀；否则按普通文字刷出。不留下半截标记，也不留下 JSON。
5. 标记只有作为结尾才生效。中间出现同样字符串时保持原样，避免误切正文。
6. 供应商 fallback 仍只发生在第一个正文分块之前。剥离层只看见胜出的那一路流。

`questionId` 由客户端在创建用户消息时用 `crypto.randomUUID()` 生成。服务端从最后一条用户消息读取并写入 seal。缺失时由服务端生成并在 seal 里回显，客户端写回那条用户消息。模型文本中的任何 id 都忽略。seal 里的 `questionId` 必须等于本轮最后一条用户消息；不一致时客户端只保留散文，不渲染卡片。

界面把同一条助手消息分成上下两部分：

- 上方是 `safeAnswer` 的 Markdown。为空时不渲染空气泡。
- 下方是授权卡。卡片来自 seal，不来自消息正文。

卡片文案由 locale 固定，不由模型生成：

> 目前已读内容还不足以完整回答这个问题。我可以查阅本作品后续的故事内容，并结合我掌握的作品背景知识继续解答，但可能会涉及你尚未读到的剧情。是否接受剧透？

英文：

> What you have read so far is not enough for a full answer. I can look through the rest of this work as it is stored here and add what I know about it, which may include parts you have not read. Do you want spoilers?

三个按钮：

1. 仅本次回答允许剧透。`Allow spoilers for this answer`
2. 开启本次对话剧透模式。`Allow spoilers for this conversation`
3. 暂不剧透。`Not now`

选择前两个按钮后，不新增用户气泡，用原问题和原 `questionId` 再请求一次。安全回答和卡片都留在原消息里，卡片标成已选择。新的剧透回答追加在后面。

选择「暂不剧透」后保持 `no_spoiler`，不自动重试。安全回答继续显示。

生成授权回答的那一次请求若在 seal 之前失败或被停止，不显示卡片。已流出的散文按现有取消或失败状态保留。用户可以重新提问。不把半截标记或 JSON 留在气泡里。已经出现卡片之后，后续剧透回答失败时，卡片恢复为可再次选择，不把失败气泡当成完整剧透答案。

三个按钮在一次点击后立即全部失效。实现上和现有 `sendingRef` 使用同一把进行中的锁，在等待网络之前同步置位。连续点击只产生一个请求。

### 6.2 会话剧透的可见控制

`conversation_spoiler` 期间，标题栏显示「剧透模式已开启」，并提供「关闭剧透」。英文为 `Spoilers are on` 和 `Turn spoilers off`。

关闭立即把会话状态改回 `no_spoiler`。已经出现的剧透消息保留。正在流出的那一条允许流完，它已经按剧透请求开始；下一条请求必须走无剧透路径。关闭不等于停止生成。

单次授权成功后不显示持久徽章。那条回答本身带「含剧透」消息标记。

### 6.3 生命周期

| 用户行为 | 状态 |
|---|---|
| 初次打开助手 | `no_spoiler` |
| 接受单次剧透 | 仅该请求使用 `single_request`。会话状态仍是 `no_spoiler` |
| 单次回答结束 | 下一条自然是 `no_spoiler` |
| 开启会话剧透 | `conversation_spoiler` |
| 连续追问，包括换话题 | 保持 `conversation_spoiler`。不做话题识别 |
| 手动关闭剧透 | 立即回到 `no_spoiler` |
| 开始新对话 | 清空消息并回到 `no_spoiler` |
| 切换路线导致助手重建 | `no_spoiler` |
| 刷新页面 | `no_spoiler` |
| 关闭或再次打开面板 | 对话还在则剧透状态也还在 |

P1 在标题栏增加「新对话」。它中止进行中的生成、清空消息、清除未完成的授权卡，并把状态设为 `no_spoiler`。现在没有这个动作，不能用关闭面板代替。

单次授权的后续生成若失败或被停止，不把空消息当成已经回答。卡片恢复为可再次选择；会话不因此进入 `conversation_spoiler`。用户若选的是会话模式，状态已经打开，但失败的气泡保持失败，不显示成完整剧透答案。

---

## 7. 历史隔离与回合封印

界面保留剧透消息。模型上下文不自动保留它们。

今天的服务端无法识别一条助手消息是否由剧透路径生成。它没有会话库，只看到客户端这次提交的 `role` 和 `content`。客户端声明的 metadata 可以被删掉或改掉。只在服务端再跑一遍「相信 metadata」的过滤，挡不住这种修改。

P1 把保证分成三层。

### 7.1 正常产品流程

官方客户端在构造下一轮请求前过滤。这是读者实际得到的隔离。

1. 仍在流式中的助手消息不发送。
2. 没有成功 seal 的助手消息不发送。取消或失败留下的半段文字属于这一类。
3. `spoilerMode` 为 `none` 时，不发送 `spoilerDisclosure` 为 true 的助手消息。
4. `spoilerMode` 为 `none` 时，不发送封印进度高于本次请求的助手消息。比较顺序是章号、`order_index`、帧下标。同一路线内退回前面的帧时，当时看过后续帧的回答不再进入上下文。
5. 情况 C 的安全散文可以进入之后的无剧透上下文。授权卡的按钮和选择结果不放进正文。
6. `conversation` 可以读取当前会话里封印有效的全部助手消息，包括剧透回答。不因为退帧删除它们。
7. 用户自己的历史问题保留。不把剧透回答压成摘要后再送回。本方案不新增历史摘要。
8. 关闭剧透后，如果新问题依赖刚被拿掉的剧透回答，模型按情况 C 重新请求授权，或请用户把要问的事再说清楚。不猜测指代，也不检测话题结束。

`single_request` 与 `conversation` 不会互相继承。

### 7.2 服务端可验证的来源

每一次成功结束的生成，由服务端在剥离标记之后追加一个 SSE 事件。模型不写这个事件。语义流守卫不认识的事件类型会原样通过，因此不需要新的响应协议栈。

```ts
type AssistantTurnSeal = {
  type: "assistant-turn-seal"
  questionId: string
  workTsid: string
  sceneTsid: string
  spoilerMode: "none" | "single_request" | "conversation"
  expandedRetrieval: boolean
  spoilerDisclosure: boolean
  spoilerAuthorizationRequest: boolean
  readUpToChapter: number
  readUpToOrderIndex: number
  readUpToStoryIndexLast: number
  contentSha256: string
  signature: string
}
```

`spoilerDisclosure` 由服务端根据本轮实际使用的检索模式填写。`single_request` 和 `conversation` 为 true。模型是否「真的讲了剧透」不参与判断。`contentSha256` 是剥离标记后的用户可见正文的 SHA-256，使用 UTF-8 字节。`signature` 是服务端密钥 `ASSISTANT_TURN_SEAL_KEY` 对上述字段的 HMAC-SHA256。密钥不出服务器。正式环境缺少密钥时，本路由返回配置错误，不发出没有封印的成功回答，避免这些回答以后被当成普通历史。

下一轮请求带回 seal。服务端对每条助手消息：

- 没有 seal，或签名与正文、作品、场景、进度、模式不一致：从模型上下文删除。
- 签名有效且 `spoilerDisclosure` 为 true，而本轮是 `none`：删除。客户端把这个布尔改成 false 仍然会被签名揭穿。
- 签名有效、`spoilerDisclosure` 为 false，但封印进度高于本轮进度：删除。客户端不能单独改低进度而保住签名。
- `conversation` 下，签名有效的剧透回答保留。

这不需要数据库。封印在当次响应里发出，下一轮请求带回来即可。

官方客户端把 seal 存在消息上。下一轮同时做第 7.1 节的过滤和服务端校验。两边规则一致；服务端校验的是签名，不是客户端自己的布尔值。

### 7.3 仍然挡不住的修改

- 用户消息不签名。读者可以把剧透写进自己的下一问。服务端不能把这句话鉴定为「来自上一轮剧透回答」。
- 无剧透回合里，模型自己写出未读情节时，封印会标明 `spoilerDisclosure: false`。这段文字会回到以后的无剧透上下文。封印证明的是检索模式，不是正文没有剧情。
- 客户端可以不附上剧透回答。这会少上下文，不会多泄露。
- 密钥泄露之后，签名可以被伪造。那是密钥管理问题，不是本契约再加一张表就能解决的。

不增加剧透文本分类器，也不增加会话表。新的 SSE 事件是值得的：签名必须由知道检索模式和最终正文的服务端发出，不能写在模型正文里。

消息上仍保留界面需要的字段：

```ts
type AssistantMessageKind =
  | "answer"
  | "spoiler_answer"
  | "authorization_request"
  | "out_of_scope"

type AssistantMessageMeta = {
  kind: AssistantMessageKind
  questionId?: string
  spoilerModeAtGeneration: "none" | "single_request" | "conversation"
  expandedRetrieval: boolean
  spoilerDisclosure: boolean
  spoilerAuthorizationRequest: boolean
  resolution?: "pending" | "accepted_single" | "accepted_conversation" | "declined"
  progressAtGeneration: {
    sceneTsid: string
    readUpToChapter: number
    readUpToOrderIndex: number
    readUpToStoryIndexLast: number
  }
  contentSha256: string
  seal: string
}
```

`kind` 和 `resolution` 只服务界面。服务端过滤以 seal 为准。用户消息的 `questionId` 在授权重试时沿用原来的 id 和正文。

---

## 8. 接口契约

继续使用 `POST /api/scene-assistant`。不新增服务。

```ts
type SpoilerMode = "none" | "single_request" | "conversation"

type SceneAssistantRequest = {
  messages: Array<{
    role: "user" | "assistant"
    content: string
    questionId?: string
    kind?: AssistantMessageKind
    spoilerDisclosure?: boolean
    expandedRetrieval?: boolean
    spoilerModeAtGeneration?: SpoilerMode
    progressAtGeneration?: AssistantMessageMeta["progressAtGeneration"]
    contentSha256?: string
    seal?: string
  }>
  sceneContext: SceneCtx
  userProgress: UserProgressBody
  spoilerMode?: SpoilerMode
  authorizedQuestionId?: string
}
```

缺省 `spoilerMode` 为 `none`，旧客户端保持今天的进度边界。

服务端规则：

- 最后一条必须是用户消息。
- `single_request` 必须带 `authorizedQuestionId`，且等于最后一条用户消息的 `questionId`。不相等返回 400，不扩大检索。服务端不保存上一次授权。
- `conversation` 不绑定 `questionId`。每一次请求都要自己带上 `conversation`。刷新后客户端内存丢失，自然回到 `none`。
- `spoilerMode` 不是数据权限。`workTsid` 仍解析为一部作品。`sceneTsid` 必须属于这部作品，否则 400。P1 对两种模式都做这个归属检查。
- 无剧透路径继续使用客户端声明的章号、`order_index` 和帧下标。把这些数字改大，不会被解释成剧透授权。它仍然只是既有的客户端进度声明。
- 剧透路径忽略客户端进度上界。作品范围由服务端按该 `work_id` 下实际存在的路线计算。客户端不能提交一个「授权到第几章」的上限。
- 没有服务器阅读账本，所以无剧透路径无法证明客户端没有抬高进度。本方案不新增账本来补这个缺口。

读者可见的回答仍是 `text-delta` 散文。情况 C 的卡片和第 7 节的封印由服务端在流正常结束时追加 `assistant-turn-seal`。这个事件不改变 ADR-003 的供应商切换。

客户端按 seal 写入 metadata，不自己推断剧透。`spoilerDisclosure` 为 true 的成功回答是 `spoiler_answer`。带授权请求的回答是 `authorization_request`，正文只保存安全散文。普通回答为 `answer`。情况 E 为 `out_of_scope`，同样由提示词产生散文，并由服务端按本轮检索模式封印。

---

## 9. 两条检索路径

串行顺序不变：SQL 候选集，然后 embedding，然后 `match_scenes`，然后按同一候选集读取 caption，再组装提示词。不新增绕过 SQL 的向量路径，也不在结果不足时改跑另一套检索。

P0 不改这一节的读取范围。P0 的无剧透路径仍是今天的 Branch A 摘要加同章 Branch B caption。下面的读取策略从 P1 开始，并且要先通过第 16 节的实施闸门。

### 9.1 无剧透路径

今天的缺口是：`metadataPreFiltering` 已经能列出进度内的全部路线，包括更早的章节；`fetchChapterScenesWithinProgress` 却只读当前章。`match_scenes` 只重排有 `rag_embedding` 的行。《三国演义》四条路线因此得到空的语义结果，更早章节的 caption 也不会从 Branch B 进来。

P1 把 caption 的来源从「向量命中的摘要」改成「SQL 候选集上的确定性读取」。

1. 解析 `workTsid` 得到 `work_id`，并确认 `sceneTsid` 属于这部作品。
2. `metadataPreFiltering` 保持现有谓词，产出 `candidateSet`。这是唯一的可见性过滤。章号小于上界，或章号相等且 `order_index` 小于等于上界。
3. 继续 `embedQuery`，再调用 `match_scenes`。它只接收这个候选集和 `work_id_filter`。返回行必须仍是候选集的子集。返回空数组是正常结果，不是失败。空嵌入的作品会走这条空结果。
4. 用同一次 `candidateSet` 读取正文，不再写第二份章号谓词：

```text
scenes.work_id = work_id
且 scenes.tsid in candidateSet
```

查询列是 `tsid`、`title`、`chapter_number`、`order_index`、`story_images_v2`。不选择 `summary`。候选很多时按每批 100 个 `tsid` 分批 `in`，再合并。分批不改变谓词。

5. 在内存里应用帧边界：
   - 章号更小，或同章且 `order_index` 更小：该路线的全部有效帧 caption。这些路线已经完整读过。
   - `tsid` 等于当前路线：只保留 `0..readUpToStoryIndexLast`，并夹到实际帧数。超过上界的帧不进入提示词。
   - 同章、`order_index` 相等、但不是当前路线：caption 为空。这保留今天对并列路线的处理。《权力的游戏》第 2 章的两条 `order_index = 0` 仍适用。
6. 不注入任何 `scenes.summary`，也不注入客户端传来的 summary。当前路线进入提示词的故事正文只有截断后的 caption，外加已有的人物名和地点名。
7. `match_scenes` 保留，但只提供纳入预算时的优先顺序。它不提供 caption 字节。没有命中时，顺序退化为从近到远的阅读顺序。

上下文预算是 JavaScript 字符串长度 24000，汉字计 1。当前目录远小于这个数，四条《三国演义》路线会全部进入。超出时按整条路线丢弃，不把一条路线切成半截故事：

1. 当前路线的已读 caption 必须保留。若仅这一条就超过预算，只保留最靠近当前帧的已读帧，仍不超过 `readUpToStoryIndexLast`。
2. 其余候选路线先放 `match_scenes` 命中的，再放其余路线。其余路线按章号、`order_index`、`tsid` 从近到远。
3. 整条路线能放下才放入。放下一条就会超预算时停止。
4. 有路线被放下时，服务端加一句不含故事的说明：更早的已读场景因长度未附上。这句不进入 story oracle。

《三国演义》读到第 2 章时，第 1 章的 caption 因此来自第 4 步的 SQL，不依赖 embedding。读到第 1 章第 0 帧时，候选集只有这一条路线的第 0 帧。这和「发家过程不在 CMS」的回归案例一致。

未读 caption 不进入模型。模型自身知识仍由提示词约束，不由这层删除。

### 9.2 剧透路径

仅当 `spoilerMode` 是 `single_request` 或 `conversation`，且第 8 节的校验通过。

候选集改为该 `work_id` 的全部路线。取得方式是同一次 SQL 列出该作品的 `tsid`，不再套用章号和 `order_index` 上界。`match_scenes` 仍只跑在这个集合上，并保留 `work_id_filter`。其他作品的 `tsid` 不能进入集合。

Caption 使用第 9.1 节的同一个读取函数，输入换成这个作品级候选集，并且不做帧截断。当前路线的后续帧也进入。不能只放宽向量、却仍注入进度内 caption。

空 embedding 时 `match_scenes` 仍可能为空。caption 来自候选集 SQL，不来自重排行。`embedQuery` 或 RPC 抛错仍是技术错误，不静默跳过向量步骤，也不写成边界句。空结果可以继续；调用失败不是空结果。

预算同样是 24000。放入顺序是：当前路线全部 caption，然后当前帧已出场人物的介绍，然后按重排顺序放入其他路线的全部 caption，最后在剩余空间放入已经入选路线的 `summary`。summary 标明是路线摘要，不能代替没放进的 caption。放不下的路线整条省略，不用 summary 顶替。人物介绍放不下时先省略介绍，不省略当前路线 caption。无剧透路径不读取人物介绍。

语义结果不包含相似度数字。客户端 summary 在两条路径都不作为故事事实。

### 9.3 Story oracle 与请求指纹

`collectAuthorizedSemanticBytes` 和 `verifyProductionStoryOracle` 的职责是锁定「哪些 caption 字节被当作故事授权面」。它把已揭示帧的 caption 按路线顺序拼成 UTF-8，中间不加分隔符，也不做 trim。`verifyProductionStoryOracle` 检查分块拼接和总缓冲是同一份字节。RAGAS v2 的 `hashRawCaptions` 复用这个 caption 边界。现有测试明确要求标题变化不改变哈希。`retrieval.ts` 也写明 summary 和重排元数据不参与这个哈希。

这个 oracle 不是整份提示词的指纹，也不是 `buildStableRequestFingerprint`。后者只标识一次请求：场景、章号、帧下标和问句。它今天不包含故事正文。

P1 不把 summary、人物卡、省略说明或 XML 包装纳进 story oracle。这些字段不是 ADR-002 的 narrative atom。放进去会改变 RAGAS 的权威边界，也会让人物卡改字看起来像故事边界被破坏。无剧透路径本来就不注入 summary 和人物卡。剧透路径可以注入它们，但它们的约束是「只来自已经授权的作品」，由查询范围保证，不由 caption 哈希保证。

P1 要改的是哈希的输入集合，不是哈希的字段：

- 只哈希预算和帧规则之后、真正写进提示词的 caption。
- 读出来后又因预算丢掉的 caption 不哈希。
- 排序改为 `chapter_number`、`order_index`、`tsid`。只按 `order_index` 排序会把不同章里相同序号的路线排乱。`hashRawCaptions` 仍按调用方给的顺序哈希，不改算法。
- 同一章内 `order_index` 唯一的旧样本，哈希不变。同一 `order_index` 有多条路线时，顺序可能相对今天的 SQL 返回顺序发生变化。这是确定性的代价，要更新对应的运行时夹具，不更新 RAGAS 的 caption 拼接定义。

`buildStableRequestFingerprint` 另加可见性模式和 `workTsid`。它仍然不吸收故事字节。两种模式的同文提问因此不会共用一个请求指纹。

第 16 节已由 ADR-002 Amendment A 接受，并已按本节编码。这是 caption 组装范围的变化，不是新的检索拓扑。

---

## 10. 两个正式回归案例

两个问题都使用《三国演义》第一条路线，`scene_1787821760006`，作品 `work_1786961407363`。它们是后续实现的验收案例，不只是文案检查。

### 10.1 张角是怎么发家的？

位置：第 1 章、`order_index` 0、帧 0。该帧 caption 已经出现 Zhang Jue 和黄巾起义，人物卡只有他，介绍只有起义领袖一句。四条路线都没有发家过程，也都没有 embedding。

预期：

- 不返回「尚未揭晓」。
- 认出已读材料里的起义和 Zhang Jue。
- 用模型知识补充太平道、传教和组织信众这一类起事背景。
- 说明这是《三国演义》开篇的通行叙述，并把它和史书记载分开；不能确定的细节标明不确定。
- 不把补充说成当前画面已经写出。
- 不继续讲败亡和后续战役。那些内容要么超出帧 0，要么根本没有入库。
- 不因为 `match_scenes` 返回空、或 CMS 没有完整记载而拒答。
- 这个位置的预期分类是情况 B，不是授权卡。若实现把所有 CMS 缺失都做成授权卡，本案例失败。

对照案例：在同一位置询问 Zhang Jue 最后的下场。预期分类是情况 C。P1 保留进度内能说的部分，并在同一条消息下显示授权卡。气泡里不出现 JSON。授权后可以结合小说知识回答，并区分小说与史书。

### 10.2 刘关张之前是干什么的？

位置：同一路线帧 2。三人已经出场，桃园相关 caption 已经可见。四条路线都没有写结义前的营生。人物卡有少量介绍，但助手今天收不到，而且介绍与通行小说营生不完全相同。

预期：

- 理解问题是在问结义前的营生，不是问画面上的兵器。
- 不把 CMS 缺少记录说成作品没有写过。
- 无剧透模式下直接补充通行小说中的早年营生，因为这不揭示帧 2 之后的情节。
- 区分小说描写和历史记载。不确定就说明不确定。
- 不把 Zhang Fei 人物卡里的「富商」偷偷当成已经展示的场景事实。P1 若在剧透路径注入人物卡，必须说这是人物卡的说法，并与小说叙述并列。
- 这个位置的预期分类同样是情况 B。

对照案例：在帧 0 询问三人是谁、后来建立了什么。帧 0 还没有他们。介绍他们的后续经历属于情况 C，不能用早年营生的答案把后面的帧一并讲完。

---

## 11. 实施阶段

### P0：回答策略

目标：去掉通用拒答，分开五种情况，允许非剧透知识补充。不改检索范围，不增加按钮。

修改：

- `src/lib/assistant-system-prompt.ts`
- `src/lib/locale/en.ts`
- `src/lib/locale/zh-CN.ts`
- `scripts/fixtures/assistant-prompt-en.txt`
- `scripts/test-locale.ts`

内容：

- 按第 4、5 节重写提示词。
- 删除两句上限和逐字拒答指令。
- 中英文提示词都不再包含旧拒答句。
- 情况 C 使用第 4 节的边界句。情况 E 使用范围说明。
- 保留 CMS 优先、不得编造、不得把模型知识伪装成正文、版本差异要分开。

接口和数据：无变化。

风险：模型仍可能把背景误判成剧透，或在无剧透模式凭记忆讲出后续情节。P0 不增加物理手段来删除模型权重中的情节。提示词测试不能证明模型遵守。

验收：

- 英文和中文提示词快照包含情况 A–E 的规则，且不含旧拒答句。
- 现有 locale 测试改为锁定新的边界句和范围说明。
- 手工用第 10 节两个案例各问一次。记录实际回答。情况 B 被答成旧拒答句或被答成纯授权请求，都算 P0 未通过。
- 断开 embedding 或故意让检索抛错时，界面显示技术错误，不显示边界句。空候选集仍能生成。

依赖：无。P0 不触碰 ADR-002 的检索上界。

### P1：授权、扩展检索、历史隔离

目标：实现第 6 到第 9 节。架构接受和本阶段编码都已完成。P2 尚未开始。

修改，以实际接线为准，不平行再造一套助手：

- `src/app/api/scene-assistant/route.ts`
- `src/services/retrieval.ts`
- `src/lib/assistant-system-prompt.ts`
- `src/lib/assistant-request-prompt.ts`
- `src/lib/assistant-generation-lifecycle.ts`
- 新增标记剥离与 HMAC 封印的纯函数，由路由在现有 SSE 之后调用
- `src/lib/production-story-oracle.ts` 只改 caption 排序和请求指纹输入，不把 summary 或人物卡纳入哈希
- `src/components/raree/ReadingRouteAssistant.tsx`
- `src/lib/locale/en.ts` 与 `zh-CN.ts` 的卡片、徽章和新对话文案
- `scripts/test-assistant-generation-lifecycle.ts`
- `scripts/test-production-story-oracle.ts`
- 检索边界测试。现有 `scripts/stress-test-rag-boundary.ts` 只覆盖进度边界，P1 增加剧透模式和跨章 caption 用例，不削弱原有断言。

内容：

- 请求增加 `spoilerMode`、`authorizedQuestionId`、消息 seal。
- 组件内增加两种会话状态、授权卡、新对话、会话剧透指示和关闭按钮。
- 情况 C 用结尾标记加 `assistant-turn-seal`。正文只渲染安全散文。
- 无剧透 caption 按第 9.1 节从候选 `tsid` 读取，并停止注入 summary。
- 剧透路径按第 9.2 节读取当前作品已入库 caption。
- 历史隔离以 HMAC 为准。单次授权只作用于原 `questionId`。

接口：第 8 节。不新增路由。新增一种 SSE 事件。

风险：

- 候选集和 caption 组装已按 Amendment A 落地。空 embedding 仍只影响排序。
- 模型漏写标记时不会出现卡片，只会留下散文。P1 提示词把标记定为情况 C 的唯一信号。
- 中止生成时，标记前缀最多损失标记长度减 1 的尾部字符。正常散文不受影响。
- 无剧透路径不再靠未截断 summary 回答跨路线问题。进度内 caption 负责替代。超预算时较远路线会被整条放下。
- 同一 `order_index` 的多条路线，oracle 排序改为章号、顺序和 `tsid` 后，运行时哈希可能相对今天变化。RAGAS 的 caption 拼接定义不变。

验收：

- 纯函数覆盖：标记被切成单字符分块时读者看不见标记；中止时不发卡片；错误签名和改过的正文被删出无剧透上下文；有效的非剧透封印保留。
- 无嵌入夹具：进度内更早章节的 caption 进入提示词，`match_scenes` 为空也不阻塞。未读帧不进入。
- 第 10 节的情况 C 对照案例同时留下安全散文和三按钮卡片，气泡里没有 JSON。选择后不新增用户气泡，并重新请求原问题。
- 《三国演义》授权后，`match_scenes` 仍可为空，但四条路线的 caption 进入提示词。
- 关闭面板再打开，会话剧透仍在。切换路线或新对话后回到无剧透。

依赖：P0 的提示词分类已经落地。P1 不依赖 P2。

### P2：测试与体验

目标：把第 12 节补成可重复验证，并处理连点、失败、多作品和可读性。

修改：

- P0 与 P1 已列出的测试脚本。
- 必要时增加助手请求夹具，不新增产品入口。
- 授权卡和错误条的组件测试。现有组件若没有测试框架，就用当前仓库已经使用的 `node --test` 或脚本断言覆盖纯函数；组件交互至少做一次浏览器验收并写入记录。

内容：

- 连点只发一个请求。
- 授权后的失败恢复卡片，不留下假的完整答案或错误 JSON。
- 刷新、重开、换路线、新对话。
- 作品隔离和进度篡改不能冒充授权。
- 用户把剧透写进自己的下一问时，服务端不会把它误判成已签名的助手历史。
- 来源区分在第 10 节两个案例上可读，答案不是来源清单。

接口：无新字段。

风险：模型评测会有波动。第 10 节的自动检查锁定禁止出现的旧拒答句、必须识别的已读事实和不得提前出现的后续结局。具体文采不做成逐字快照。

依赖：P1 完成后做端到端验收。纯提示词断言可以在 P0 先存在。

---

## 12. 测试矩阵

| # | 情况 | 预期 |
|---|---|---|
| 1 | 当前 caption 已含答案 | 直接回答，不发授权卡 |
| 2 | CMS 没有细节，但补充不会剧透 | 情况 B，直接补充 |
| 3 | 必须越过阅读边界 | 情况 C。P0 用边界句。P1 同时保留安全散文和授权卡，正文里没有 JSON |
| 4 | 授权后 CMS 有后续正文 | 回答使用后续 caption，并带剧透标记 |
| 5 | 授权后 CMS 仍没有完整内容 | 使用模型知识补充，不说作品没有记载 |
| 6 | CMS 与模型知识冲突 | 先说 CMS，再分开说明其他来源 |
| 7 | 小说、史书、改编不一致 | 明确区分，不确定则说明 |
| 8 | 模型不能确定细节 | 有限解释，不编造确定事实 |
| 9 | embedding 或 RPC 抛错 | 技术错误，不出现旧拒答句或边界句 |
| 10 | 作品没有 embedding | 进度内 caption 仍由候选 `tsid` 的 SQL 读出。不依赖 `match_scenes`。无剧透路径不注入 summary |
| 11 | 初次打开 | `no_spoiler` |
| 12 | 单次授权 | 原问题得到扩展回答 |
| 13 | 单次回答之后的新问题 | 回到无剧透，不继承授权 |
| 14 | 会话剧透后连续追问 | 不再次要授权 |
| 15 | 会话剧透期间换话题 | 保持会话剧透 |
| 16 | 手动关闭 | 下一条立即无剧透 |
| 17 | 连点授权按钮 | 只有一个请求 |
| 18 | 授权后生成失败 | 不显示成完整答案，可以再次选择 |
| 19 | 单次与会话模式 | 互不改写对方的状态 |
| 20 | 单次剧透回答留在界面 | 不进入下一条无剧透模型历史 |
| 21 | 会话剧透开启 | 模型可以看到本会话完整历史 |
| 22 | 关闭会话剧透 | 剧透回答不再进入模型上下文 |
| 23 | 关闭后追问剧透细节 | 不把旧答案送回，重新请求授权或不猜测指代 |
| 24 | 关闭面板再打开 | 保留对话和会话剧透 |
| 25 | 新对话 | `no_spoiler`，消息清空 |
| 26 | 刷新 | `no_spoiler` |
| 27 | 切换路线 | 助手重建，`no_spoiler` |
| 28 | 当前作品检索 | 不含其他作品 |
| 29 | 授权 | 不绕过 `work_id` 和场景归属检查 |
| 30 | 客户端抬高进度 | 不被视为剧透授权。无剧透路径仍按声明进度截断 |
| 31 | 只有开篇路线的作品 | 不声称 Raree 已录入整部小说 |
| 32 | 剧透路径 | SQL 候选集与 caption 注入同属当前作品；无剧透路径不注入未读 caption |
| 33 | 情况 C 的安全回答为空 | 只显示授权卡，不显示空气泡，也不显示标记 |
| 34 | 标记被分块、生成中断或供应商在首字前失败 | 不留下标记或 JSON。中断不显示卡片。首字前的失败仍可 fallback |
| 35 | 无嵌入作品已读到后续章 | 更早章节的已读 caption 进入无剧透上下文 |
| 36 | 已读 caption 超过 24000 | 保留当前路线已读 caption，较远路线整条省略，并有一句无故事的长度说明 |
| 37 | 助手消息的 seal 被改或被去掉 | 无剧透请求不把该助手消息送入模型 |
| 38 | 用户消息重复了剧透内容 | 服务端不把它当成可验证的助手剧透来源 |
| 39 | 只改 summary 或人物卡 | story oracle 的 caption 哈希不变 |
| 40 | 预算丢掉部分 caption | oracle 只哈希实际注入的 caption |

第 10 节两个案例分别覆盖第 2 行和第 5 行。它们的对照问题覆盖第 3 行。

---

## 13. 推荐方案与被否决的做法

授权状态放在助手组件内存里。对话本来就在这里，路线切换和刷新已经会清空它。父组件或浏览器存储都比现有生命周期更大。

剧透范围用每次请求上的 `spoilerMode` 表达。服务端不建会话库。单次授权靠 `questionId` 绑定，避免浏览器里残留一个布尔值就被下一问复用。

扩展检索仍走现有函数：给 `metadataPreFiltering` 和 caption 读取加一个作品范围模式。不新写一套向量服务。

情况 C 的用户文案放在 locale。模型只在散文末尾写固定标记。卡片和 HMAC 由服务端发出。这样按钮不随模型措辞漂移，浏览器也不会把 JSON 交给 Markdown。

无剧透路径的 caption 来自同一次 SQL 候选集。`match_scenes` 只排序。没有嵌入时历史 caption 仍然可读。超长时整条路线省略，不用 summary 顶替。

不采用的做法：

- 不让模型判断话题结束并自动关闭会话剧透。
- 不把关闭面板当成新对话。
- 不把旧拒答句保留为空检索、技术错误和范围外问题的后备。
- 不因为要实现剧透而取消无剧透 SQL 过滤。
- 不把中文译文注入助手。那与已经实施的本地化边界冲突。
- 不在无剧透路径注入全部人物介绍。
- 不新增账户级剧透偏好。
- 不把判别联合 JSON 流式发给浏览器，也不改用 JSON mode 代替现有文字流。
- 不把 summary 和人物卡并进 production story oracle。
- 不因为客户端可能改 metadata，就声称服务端能识别任意未签名正文里的剧透。

---

## 14. 风险

- 无剧透模式仍可能由模型记忆泄露后续情节。物理截断管不到权重。P2 用第 10 节的禁止项检查明显结局，但不能证明所有问法都安全。
- 模型可能把情况 B 误判成情况 C，造成新的过度授权。第 10.1 节是这条风险的阻断测试。
- `match_scenes` 的函数体没有读到。空 embedding 返回空行是调用结果。若函数日后改成对空向量报错，第 9.2 节的「抛错即技术失败」仍然适用。
- 《权力的游戏》同一章两条 `order_index = 0`。本方案不重排这个数据。无剧透路径改为 caption 后，非当前的同序路线仍按今天的 Branch B 规则得到空 caption。
- 客户端进度在无剧透路径仍被信任。抬高进度今天就能看到更后的已入库内容。剧透开关不能收紧这个既有缺口。
- 已入库摘录不完整。授权后的「作品范围」是数据库里的路线，不是整本小说。提示词必须保持这个区别。
- HMAC 只证明助手回合的检索模式和正文没有被改过。它不能阻止用户把剧透写进下一问，也不能阻止无剧透回合里模型自己写出未读情节。
- 模型漏掉结尾标记时，P1 不会出现授权卡。这比把半截 JSON 显示出来更安全，但情况 C 会退回纯散文。

---

## 15. 实施前提

1. 第 16 节已记入 ADR-002 Amendment A 与可见性不变量 Amendment A。P1 可以在收到实施指令后改候选集和 caption 组装。
2. 无剧透路径继续信任客户端进度。不新增阅读账本。
3. 24000 的字符串预算按第 9 节执行。若以后要改数字，只改阈值，不改候选集定义。
4. P0 手工验收仍要有人执行第 10 节的真实提问。提示词快照不能代替这次提问。

不在本方案中决定的事：译文进入助手、人物实体检索、话题自动识别、剧透偏好持久化、重排相同 `order_index` 的路线。

---

## 16. 已接受的 ADR 修订

2026-11-17 接受。规范文本是 [ADR-002 Amendment A](../adr/002-hybrid-rag-retrieval.md) 和可见性不变量第 14 节。下面保留当时的决定摘要，不再另写一份 ADR。

ADR-002 的默认产品边界保持不变：没有剧透授权时，`metadataPreFiltering` 仍用 `readUpToChapter` 与 `readUpToOrderIndex`，当前路线 caption 仍截到 `readUpToStoryIndexLast`。

增加一个显式例外。请求携带通过校验的 `single_request` 或 `conversation` 时：

- SQL 候选集是该 `work_id` 的全部路线。
- 向量重排仍只跑在这个候选集上。
- 注入模型的 caption 与 summary 只能来自这个候选集。
- 该模式不使用客户端进度作为上界。

可见性不变量第 3 节的「授权」增加同一种例外。用户未授权时，超过 `readUpToStoryIndexLast` 的当前路线 caption 仍不得进入模型上下文。用户已按本文授权时，授权集合改为该作品已入库路线的全部 caption。模型权重中的知识不是 story token，不靠这条物理规则删除；无剧透提示词继续禁止讲述未读情节。

无剧透提示词不再注入 `scenes.summary`。进度内 caption 由同一次 `candidateSet` 读取：更早路线取全部有效帧，当前路线截到 `readUpToStoryIndexLast`。`match_scenes` 只决定超预算时的保留顺序。空嵌入不阻止这次读取。Layer 2 因此不会宽于 Layer 1。

Production story oracle 的字段范围不变，仍然只哈希实际注入的 caption。请求指纹单独记录可见性模式。

串行顺序、作品隔离、空结果不改走第二条检索、调用失败不伪装成剧情未揭晓，这些都不变。

---

## 17. 实现时的代码对应

| 设计 | 现有位置 | 后续动作 |
|---|---|---|
| 进度快照 | `ReadingRouteExperience` 中的 `sceneAssistantUserProgress` | P1 原样继续作为无剧透上界 |
| 英文规范上下文 | `canonicalSceneAssistantContext` | 不接入译文 |
| 人物名 | `presentCharacters.map(name)` | 剧透路径另按作品读取已出场人物的 `description` |
| SQL 上界 | `metadataPreFiltering` | P1 增加作品全量模式 |
| 帧截断 | `fetchChapterScenesWithinProgress` | P1 改为按同一次候选 `tsid` 读取，再在内存里截帧 |
| 空向量结果 | `match_scenes` 之后仍生成 | 保持。caption 不从重排行读取 |
| 摘要注入 | `buildContextXml` 与 `sceneContext.summary` | P1 无剧透路径移除。剧透路径只给已经入选的路线附上数据库 summary |
| 拒答句 | `closedDomainRefusal` 与 `buildAssistantSystemPrompt` | P0 退出提示词 |
| 历史 | `historyTurnsForRequest` | P1 官方客户端先过滤。服务端按 HMAC 删除无效或越界的助手消息 |
| 回合封印 | 现有 UI Message SSE | P1 在流正常结束时追加 `assistant-turn-seal` |
| 消息渲染 | `ReadingRouteAssistant` 的 Markdown 分支 | P1 只渲染散文。卡片来自 seal |
| Story oracle | `collectAuthorizedSemanticBytes` | P1 仍只哈希实际注入的 caption，并改为稳定的跨章排序 |
| 面板生命周期 | `open` 与 `key={visualReadingRoute.tsid}` | 关闭保留状态；换路线自然重置 |
| 技术错误 | `route.ts` 与 `executeVerifiedGeneration` | 不改成情节文案 |
