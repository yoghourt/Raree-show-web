# Reader Guide 2.0 — 最终验收

**Status:** Closed for current scope; known spoiler risk remains  
**Date:** 2026-11-17  
**Does not claim:** Spoiler leakage fixed. Zero-spoiler guaranteed. All spoiler regression tests passed.

本文件关闭当前开发范围。它不改应用代码，也不把已知的模型泄漏改写成通过。

## 1. 最终产品决策

接受当前授权机制和已经落地的功能。保留已知的无剧透模型行为风险。不再为了证明绝对无剧透而增加 Prompt 规则或审核模型。

| 项 | 状态 |
|---|---|
| P2-A | Implemented |
| P2-B.1 | Implemented; known content leakage remains |
| P2-B.2 | Deferred. Not implemented. Not on the active roadmap |
| P2-C | Functionally accepted with documented limitations |
| Reader Guide 2.0 | Closed for current scope; known spoiler risk remains |

P2-C 的功能验收可以关闭。严格意义上的零残余泄漏行为标准没有通过。这两个事实同时成立。

## 2. 当前实际运行流程

默认 `spoilerMode=none`。一次请求只检索一次，范围停在当前阅读进度。Stage 1 先做问题级判定。`authorization_required` 和 `uncertain` 只发授权卡。`out_of_scope` 使用服务端固定句。`answer_allowed` 用现有无剧透提示流式生成。单次授权复用原 `questionId`。会话授权每次显式携带 `conversation`。关闭剧透后的下一请求回到 `none`。HMAC 和历史过滤不变。

## 3. 分阶段情况

P2-A 已实现。结构测试用假供应商证明：授权和 `uncertain` 不进入 Stage 2，授权前的用户流没有模型自由叙述。

P2-B.1 已实现。提示要求按当前阅读进度回答，并禁止未揭示前史和事后评价。真实模型回归没有全部遵守。这是已知内容泄漏，不是功能未实现。

P2-C 的结构测试、真实授权往返和主要异常路径已经做过。功能层面按当前范围接受。内容行为层面的零残余泄漏标准没有通过，因此不能写成行为验收全部通过。

## 4. 2026-11-17 收尾时重跑的自动化测试

以下命令退出码为 0。假供应商和真实数据库不要混读。

| 命令 | 证据类型 | 结果 |
|---|---|---|
| `npx tsc --noEmit` | 类型检查 | 通过 |
| `npx tsx scripts/test-reader-guide-p1.ts` | 结构：预算、标记、HMAC、历史 | 通过 |
| `npx tsx scripts/test-reader-guide-p2a.ts` | 结构：假 Stage 1 | 通过 |
| `npx tsx scripts/test-reader-guide-p2b-prompt.ts` | 组装后的提示文本，不是模型行为 | 通过 |
| `npx tsx scripts/test-assistant-generation-lifecycle.ts` | 结构：重试消息以原问题结尾 | 通过 |
| `npx tsx --experimental-test-module-mocks scripts/test-reader-guide-p2c.ts` | 结构：假供应商和假检索 | 通过 |
| `npx tsx --experimental-test-module-mocks scripts/test-locale.ts` | 提示与 locale 文本 | 通过 |
| `npx tsx scripts/test-reader-guide-retrieval.ts` | 真实数据库上的进度边界 | 通过 |

本轮没有调用真实生成模型。此前的失败回答仍然有效。

这些测试支持的功能结论：

- 默认 `none`。Stage 1 在 Stage 2 之前。
- 授权和 `uncertain` 不进入 Stage 2。`out_of_scope` 是服务端固定句。
- 合法 `single_request` 跳过 Stage 1，并要求 `authorizedQuestionId` 匹配。不匹配则在检索前 400。
- `conversation` 跳过 Stage 1。缺省模式按 `none` 重新判定。
- 每次请求只检索一次。Stage 1 与无剧透 Stage 2 使用同一批已揭示 caption。
- 授权前的授权响应没有模型自由叙述。
- HMAC 拒绝篡改。无剧透历史丢掉剧透回答。失败和取消不产生有效 seal。
- 客户端信号中止返回 499。供应商 `AbortError` 在信号未中止时可以换备用供应商。第一个正文分块之后不换供应商。

## 5. 真实路由与测试替身

浏览器打开真实页面，请求打到真实 `/api/scene-assistant`。检索使用真实数据库。生成由开发环境的 Scripted Provider 驱动，日志中的供应商是 `scripted`，不是 Gemini。

| 路径 | 结果 |
|---|---|
| 同一轮连点「仅本次」 | 只有一条 `single_request`。服务端一次 `generateText`、一次 `stream delta` |
| Stage 1 非法 JSON | 502。界面为「生成请求无效。」没有授权卡，没有助手气泡 |
| Stage 2 在正文前失败 | 502。没有语义锁。界面为「生成服务暂时不可用。」没有有效回答 |
| 流在锁定后挂起，并关闭面板 | 只留下用户消息。助手气泡被去掉，没有「含剧透」 |
| 生成中切换路线 | 新场景的向导是空的，没有旧问题 |

这些证明路由和前端状态，不证明 Gemini 的回答内容。

## 6. 真实前端与受控 SSE

下列两项替换了页面里的 `fetch`，没有经过真实 API 路由。

- 同一轮两个授权事件只显示一张卡，第二次摘录没有出现。
- 错误 `questionId` 显示「生成请求无效。」，没有授权按钮，没有助手气泡。

## 7. 真实浏览器与真实 API

第 0 帧上，生成使用真实 Gemini，不是测试替身。这是功能往返证据，不是内容行为证明。

- 「张角最后的下场是什么？」出现授权卡。服务端候选集为 1、244 字，没有进入 Stage 2。中文问题对不上英文 caption，摘录为空。
- 「仅本次」复用原问题和原 `questionId`，请求里该用户消息只出现一次。随后检索候选集为 4、2774 字，并锁定生成。回答带「含剧透」，没有持久剧透条。
- 「开启本次对话」后的请求是 `conversation`，不带 `authorizedQuestionId`。下一问仍是 `conversation`。
- 点「关闭剧透」时，正在流出的请求仍按 `conversation` 结束。下一问是 `none`，剧透条消失。
- 「暂不剧透」不增加请求，也不触发第二次生成。

## 8. 真实模型回归中保留的失败

进度都是《三国演义》第一条路线、第 0 帧。不要把这些案例改成允许的静态背景。

| 案例 | 结论 |
|---|---|
| 南华老仙授书 | 早期「介绍一下张角」中出现，属于未揭示前史。P2-B.1 后的两次介绍没有复现。历史失败保留 |
| 张宝、张梁 | 无剧透的「张角为什么发动起义」中出现，属于未揭示人物关系泄漏 |
| 太平道撼动汉室统治 | 「太平道是什么」两次出现，属于事后视角评价泄漏 |
| 群雄并起序幕 | 早期无剧透回答中出现，属于未揭示后续格局。后续回归没有再次出现。历史失败保留 |

P2-B.1 降低了部分泄漏。Stage 1 仍可能误放行。Stage 2 仍可能用模型参数知识补上未揭示剧情。Prompt 不是结构性安全保证。接受这些残余风险，不等于这些内容通过了无剧透验收。

## 9. 当前安全边界

功能上，系统按读者给出的授权状态选择检索范围，并在授权决定之前不发送模型自由叙述。内容上，无剧透回答仍可能写出未揭示的人物关系或事后评价。不承诺绝对零剧透。以后如果改检索、提示、模型或授权行为，要重新评估这条边界。

## 10. P2-B.2

`docs/specs/reader-guide-2.0-answer-disclosure-audit-design.md` 保留原方案。状态仍是 `Deferred. Not implemented. Not on the active roadmap.`

不实施第二次审查、主张拆分、引用校验链、草稿缓冲、自动重写、额外模型调用，以及新的前端状态或 HMAC 类型。只有在明确接受更长等待，并且仍认为残余泄漏不可接受时，才重新评估。

## 11. 重新打开当前范围的条件

当前范围已关闭。重新打开只在产品明确要求改变授权、检索或无剧透行为时发生。重新打开不等于自动实施 P2-B.2。
