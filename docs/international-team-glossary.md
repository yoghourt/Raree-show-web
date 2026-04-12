# 国际团队工作语言速查手册

> Day 10 整理 · Evan 的国际远程求职 60 天计划配套材料
>
> 这不是一份名词表，是一份**场景化速查手册**。
> 每个概念都配一个真实工作场景或例子，方便理解和记忆。
>
> **使用方法**：不要试图一次记住所有概念。把它当成参考书，遇到不确定的时候回查。
> 真正的掌握来自反复在实际工作中使用这些词。

---

## 目录

- [Part 1: 协作与流程](#part-1-协作与流程)
- [Part 2: 文档与决策](#part-2-文档与决策)
- [Part 3: 需求与范围](#part-3-需求与范围)
- [Part 4: 进度与状态](#part-4-进度与状态)
- [Part 5: 交付与发布](#part-5-交付与发布)
- [Part 6: 沟通与文化](#part-6-沟通与文化)
- [Part 7: 写作技巧](#part-7-写作技巧)
- [Part 8: 自查清单](#part-8-自查清单)

---

## Part 1: 协作与流程

### Ticket ⭐

**直白定义**：任何工作的最小单元，记录在 Jira / Linear / GitHub Issues。

**类型**：
- **Bug**：现有功能坏了
- **Feature**：要新做一个功能
- **Chore**：杂活（升级依赖、清理代码）
- **Spike**：调研型工作（产出是文档不是代码）

**核心潜规则**："**If it's not in the tracker, it doesn't exist.**"
（不在系统里的工作 = 不存在 = 绩效评估时无法被证明）

**面试雷区**：被问"如何处理模糊任务"时，正确答案是"I created a ticket to scope it out"，不是"my manager told me on chat"。

---

### Spike ⭐

**直白定义**：1-3 天的调研型工作，目的是"知道某条路能不能走"。**产出是 note 或决策，不是代码**。

**词源**：橄榄球术语，意思是"试探性进攻"——不要赢，只要知道对面有多硬。

**典型场景**：
- 不知道某个新技术能不能解决我们的问题 → 做个 spike 验证
- 不知道某个 feature 实现起来有多复杂 → 做个 spike 估算
- 团队对某个方案有分歧 → 做个 spike 用数据说话

**关键特征**：spike 结束时**不需要交代码**。只需要交一份"我们现在知道该怎么做了"或"这条路走不通"的结论。

**你的应用**：今天下午要做的 RAG 调研就是一个 spike。

---

### Standup ⭐

**直白定义**：每天 15 分钟的简短同步，每个人说三件事：
1. **What I did yesterday**（昨天做了什么）
2. **What I'll do today**（今天打算做什么）
3. **Any blockers**（有什么阻碍）

**Async standup**：很多远程团队不开实时会议，而是在 Slack 里写文字版。对亚洲时区候选人特别友好。

**核心潜规则**：**藏 blocker 是大忌**。提 blocker 不是抱怨，是正式请求帮助。

---

### Blocker ⭐

**直白定义**：你想推进但因为外部原因卡住的事情。

**例子**：
- "I'm waiting on the Figma from design"（等设计师交 Figma）
- "API documentation isn't ready yet"（API 文档没出）
- "I need access to the staging environment"（需要测试环境权限）

**核心动作**：发现 blocker 立刻 surface（公开提出），不要藏。

**心理学背景**：国内文化里"独立解决"被视为美德，导致工程师藏 blocker。国际团队反过来——**藏 blocker = 独立性差 + 不会求助**。manager 会担心你 burnout（耗竭）。

---

### Sprint ⭐

**直白定义**：把工作切成固定时长的小段（一般 1-2 周），每段开始时计划，结束时回顾。

**和国内"季度绩效"的关键区别**：
- 国内：sprint 完成度 → 绩效 → 工资
- 国际：sprint 完成度 → 学习材料 → 调整下个 sprint 的计划
- 绩效评估是另一套系统（半年或一年一次的 performance review）

**为什么这个差别很重要**：国内的挂钩模式鼓励工程师**隐藏问题**，因为暴露问题影响绩效。国际的脱钩模式鼓励**真实汇报**，因为汇报本身没有惩罚。

**面试警告**：不要在简历里写"季度绩效 A"或"超额完成 KPI 30%"。国际招聘方读出的是"高压工作文化"，不是"优秀员工"。

---

### Backlog ⭐⭐

**直白定义**：所有还没做的 ticket 的清单。

**和你的 TODO 列表的关系**：你 CONTEXT.md 里的 TODO 列表本质就是个 backlog。

**Backlog grooming**："整理待办池"。定期（一般每周）回顾 backlog，删掉过时的、给重要的排优先级、把模糊的 ticket 写清楚。

---

### Scope ⭐

**直白定义**：一个 ticket / PR 包含哪些工作。

**Scope creep**：做着做着发现自己改了一堆原本不该改的东西。

**正确的处理方式**：
1. 停下
2. 在 ticket 写 comment："I discovered X. The original scope no longer makes sense. Two options: (a) split into two tickets, (b) descope feature Y. @manager please advise."
3. 等回复，再继续

**关键动作**：**把决策权交还给 ticket owner**，不是自己默默扩大 scope。

**你已经在做的事**：Day 6 立的"任务边界纪律"就是反 scope creep 的私人版。

---

### MVP ⭐

**Minimum Viable Product**：能跑、能演示、但功能极简的版本。

**和国内"第一版"的区别**：MVP 强调的是 **viable**（可用、能验证假设），不是 **complete**（完整）。MVP 的目的是**尽快放到用户面前收集反馈**，不是"先做个简陋版本将就着用"。

**Lean Startup 文化**：MVP 来自《精益创业》一书，核心思想是 "Build → Measure → Learn → Repeat"（构建 → 测量 → 学习 → 重复）。

---

### WIP ⭐

**Work In Progress**：还没完成的工作。

**Draft PR**：草稿 PR，意思是"这个 PR 还没写完，我先开着让你看看方向，别急着 review"。

**WIP limit**：限制同时进行的任务数量。Kanban 看板的核心理念之一——同时做太多事会降低质量。

---

### 1:1 ⭐⭐

**直白定义**：你和直属老板的一对一会议，一般每周一次，15-30 分钟。

**和国内"汇报"的关键区别**：
- 国内汇报：你向上级汇报进度
- 国际 1:1：双向沟通——你提你的想法、卡点、职业发展疑问，老板给你反馈、上下文、资源支持

**1:1 的核心潜规则**：**1:1 不讨论具体 ticket**。ticket 在 standup 里说，1:1 谈更深层的事：
- 我手头任务的真实卡点（比 standup 更深的版本）
- 我对最近某个决定的疑虑
- 我的职业发展方向
- 我对团队/公司的反馈
- **我想要的成长机会**

**最后一条对你特别重要**：国际团队里**主动要成长机会被鼓励**，不是"野心太大"。在 1:1 里说 "I'd like to lead the next AI integration project" 完全 OK。

---

### Standup vs 1:1 vs Retro 的区别

| 会议类型 | 频率 | 时长 | 谈什么 | 不谈什么 |
|---|---|---|---|---|
| Standup | 每天 | 15 分钟 | 今天要做什么 + blocker | 不谈细节、不讨论问题 |
| 1:1 | 每周 | 15-30 分钟 | 你的成长、卡点、反馈 | 不谈具体 ticket |
| Retro | 每周/每两周 | 30-60 分钟 | 流程问题、感受、改进 | 不汇报进度（看 Jira 就够） |

---

## Part 2: 文档与决策

### Spec / Specification ⭐⭐

**直白定义**：写代码**之前**写的文档，描述"我们要做什么、为什么做、做成什么样、不做什么"。

**最重要的事**：spec 里**没有代码**。它是一份让人讨论的文档。

**和国内"需求文档"的关键区别**：
- 国内需求文档由 PM 写，描述"产品要什么"
- 国际 spec 由工程师写，描述"我们决定怎么解决这个问题"
- spec 是工程师的文档，PM 的文档叫 PRD（Product Requirements Document）

**典型结构**：
```
# Spec: [Feature Name]
**Status**: Draft | In Review | Approved | Implemented
**Author**: ...
**Reviewers**: ...

## Background    （为什么需要这个 feature）
## Goals         （要做什么）
## Non-goals     （不做什么 - 这一段最重要）
## Proposed approach  （怎么做）
## Open questions     （还没想清楚的事）
## Risks              （可能失败的地方）
```

**核心心法**：写 spec 的过程不是"我已经想好了，写下来给你看"，而是 **"我以为我想好了，写的过程发现自己没想清楚的地方"**。

---

### Design doc ⭐⭐

**直白定义**：和 spec 几乎同义，但侧重 "怎么做" 而非 "做什么"。

**实际区别**：
- **Spec** 偏向"我们要做什么"——描述需求和接口
- **Design doc** 偏向"我们怎么做"——描述架构和实现路径

**你不用纠结区别**：看到任一个都知道是"动手前写的文档"就行。Google 的工程师文化里 "design doc" 更常用；初创公司里 "spec" 更常用。

---

### RFC ⭐⭐⭐

**Request for Comments**：征求意见稿。

**和 spec 的区别**：
- **Spec / Design doc**：作者已经基本想清楚，写出来让人确认
- **RFC**：作者有想法但还没拍板，写出来征求意见再决定

**典型应用场景**：
- 跨团队的接口设计
- 影响多人的架构变动
- 有争议的技术选型

**和你的 solo project 的关系**：你是单人开发，没有人需要 review 你的 RFC，**这个概念可以推迟到加入团队后再练**。

---

### ADR ⭐⭐

**Architecture Decision Record**：架构决策记录。

**直白定义**：记录一个**已经做出**的技术决策，包括为什么这么定、考虑过什么替代方案。

**和 spec 的区别**：
- **Spec 是前瞻**：要做什么、怎么做
- **ADR 是回顾**：为什么这么决定、为什么不那么决定

**典型结构**：
```
# ADR-XXX: [Decision Title]
**Date**: 2026-04-13
**Status**: Accepted | Deprecated | Superseded by ADR-YYY

## Context
（当时的情况是什么、有什么约束）

## Decision
（最终决定是什么）

## Alternatives considered
（还考虑过哪些方案 + 为什么没选）

## Consequences
（这个决策的好处和代价）
```

**核心潜规则**："**Decisions live in writing, discussions live in meetings.**"
（决策活在文字里，讨论活在会议里。）

**你已经在做的事**：你的 CONTEXT.md 里"重要设计决策"那一节就是一组 ADR 的雏形。

**你需要新增的动作**：**每个重要决策都写一份 ADR**，哪怕你自己同意自己。重点不是协调分歧，是**留下决策痕迹给 6 个月后的自己**。

**面试金矿**：被问"讲一个你做过的重要技术决策"时，能掏出一份真实 ADR 比口头复述强 100 倍。

---

### Postmortem ⭐⭐

**直白定义**：事故复盘报告。当生产环境出大事故时事后写。

**典型结构**：
```
# Postmortem: [Incident Name]
## What happened
## Timeline
## Root cause
## What went well
## What went wrong
## Action items
```

**核心文化**：**Blameless**（不追究个人责任）。

**和国内的关键区别**：
- 国内 postmortem 经常变成"谁的责任"
- 国际团队任何指向个人的 postmortem 都被视为**团队失败**——它说明流程没保护住人

**为什么这个文化重要**：追责文化让员工**隐瞒事故**，反而让系统变得更危险。Google SRE 手册专门有一章讲 blameless postmortem。

**你的经验**：你写过不少 postmortem，但中文团队的 postmortem 经常带 blame。**到了国际团队，要主动去掉所有指向个人的语言**。

---

### PR description ⭐

**直白定义**：Pull Request 的文字说明，解释你为什么改、改了什么、怎么测的、有什么已知问题。

**核心潜规则**："**The PR description is for the reader six months from now, not for the reviewer today.**"
（PR 描述不是写给今天的 reviewer 看的，是写给 6 个月后的读者看的。）

**典型 5 段结构**：
```
## What
（这个 PR 做了什么 - 一句话总结）

## Why
（为什么做 - 背景和动机）

## How
（怎么做的 - 关键的实现选择）

## Testing
（怎么测的 - 别人怎么验证它能用）

## Known limitations
（已知问题和后续 follow-up）
```

**为什么这个对你这么重要**：招聘方看你 GitHub 时，**先看 PR description 写得怎么样，再看代码**。代码能力可以面试时考，但"会不会把上下文留给未来的人"——只能通过 PR 历史看出来。

**你已经在做的事**：raree-show 的 PR #1 到 PR #12 都有英文描述。继续保持。

---

## Part 3: 需求与范围

### Requirements ⭐

**直白定义**：spec 里通常有一段叫 Requirements，列出 feature 必须满足什么条件。

**两种**：
- **Functional requirements**（功能性需求）：必须能做什么
- **Non-functional requirements**（非功能性需求）：性能、安全、可用性等"质量属性"

**例子**（Scene Assistant）：
- Functional：能回答 Q1/Q2/Q3 三类问题
- Non-functional：响应延迟不超过 3 秒；spoiler 0 容忍

**和国内"需求文档"的关系**：内容差不多，但国际工作流里 requirements 是**工程师 spec 的一部分**，不是一份独立的 PM 文档。

---

### Acceptance criteria ⭐⭐

**直白定义**：怎么算这个 ticket 完成了。

**关键潜规则**：在动手之前就把"完成的定义"写死，避免事后扯皮。

**写法**：用 "Given / When / Then" 结构。
```
Given a user is viewing scene 50,
When they ask "Has Tyrion appeared before?",
Then the assistant should list scenes 1-49 where Tyrion is in character_ids,
And it must NOT mention any scene with order_index >= 50.
```

这种格式叫 **BDD-style**（Behavior-Driven Development，行为驱动开发）。

**核心要求**：**可验证**。能直接拿来写测试。

**和国内"测试范围"的关系**：内容相似，但国际工作流里 acceptance criteria 是**ticket 创建时就写**的，不是测试阶段才补的。

---

### In scope / Out of scope ⭐⭐

**直白定义**：spec 里通常有两段，分别叫 "In scope"（范围内）和 "Out of scope"（范围外）。

**为什么 Out of scope 特别重要**：它**显式**告诉读者"我知道你可能期望 X，但我们这次不做 X"。

**潜规则**：把暗含的写明白（make the implicit explicit）。

**你需要新增的动作**：每个 PR description 加一段 "Out of scope" 列出"这次故意不做什么"。这是反 scope creep 的物理屏障。

**例子**（你的 raree-show）：
```
## Out of scope
- Multi-volume cross-references (deferred to Phase 2)
- Plot reasoning questions (intentionally excluded - see RFC-001)
- Image-based retrieval (Phase 3)
```

---

## Part 4: 进度与状态

### Milestone ⭐⭐

**直白定义**：达到某个状态时算作一个标志点。

**和 deadline 的区别**：
- **Deadline**：必须 X 时间之前完成
- **Milestone**：达到 X 状态时算一个里程碑（更柔性，不一定带具体日期）

**你的疑问"大版本吗？"**：相关但不完全等同。大版本（v1.0、v2.0）通常对应一个 milestone，但 milestone 的颗粒度可以更细：
- "Phase 1 complete"（Phase 1 完成）
- "First 10 users onboarded"（前 10 个用户上线）
- "Postgres migration done"（Postgres 迁移完成）

---

### Roadmap ⭐⭐⭐

**直白定义**：路线图。比 milestone 更宏观，通常覆盖几个月甚至一年。

**典型例子**：
```
Q1 2026: Ship MVP (Phases 1-3 of CONTEXT.md)
Q2 2026: Add multi-language support
Q3 2026: Mobile app
Q4 2026: Enterprise features
```

**面试场景**：初创公司面试经常问 "Tell me about your roadmap"——不是问技术细节，是测试你能不能用**产品语言**讲战略。

**你需要新增的动作**：**每周末花 10 分钟写下周的 mini-roadmap**。3-5 条 bullet 描述"下周想推进什么"。这是为 Day 14 写简历做准备。

**你已经在做的事**：你的 60 天 sprint 计划本身就是一份 personal roadmap。

---

### Estimate ⭐⭐

**直白定义**：工时估算。

**你之前的痛点**：
> "估真实工时 → 测出 out of scope → 加班消化"
> "多估一些 → 假装上班难受"

**国际团队的解法**：**Range estimate**（区间估算）。

写两个数字：
- **Best-case**：顺利情况下需要的时间
- **Realistic**：带风险缓冲的时间

例子：
> "This will take 2-4 days. Best case 2 days if the OAuth library works as documented; realistic 4 days because I expect some integration issues."

**为什么这个写法解决你的痛点**：
1. **诚实**：不掩盖不确定性
2. **保护自己**：实际花了 4 天没人会说你慢，因为你提前说过
3. **训练 manager**：让 manager 学会 plan around uncertainty（围绕不确定性做计划）

**配套概念**：**Buffer**（缓冲时间）。你的 estimate 里**应该**包含 buffer，不是隐瞒。

---

### Velocity ⭐⭐⭐

**直白定义**：一个团队每个 sprint 平均能完成多少 story points。

**核心警告**：**不要把 velocity 变成绩效指标**。一旦如此，工程师会**虚报估算**让自己看起来 velocity 高。这种"测量扭曲行为"现象叫 **Goodhart's Law**：
> "When a measure becomes a target, it ceases to be a good measure."
> （当一个指标变成目标，它就不再是一个好指标。）

**和你的关系**：你是 solo project，没有 sprint velocity。这个概念可以推迟。

---

## Part 5: 交付与发布

### Ship ⭐⭐

**直白定义**：发布、交付。国际团队最核心的动词之一。

**关键文化**：**完成 90% 但没上线的功能 = 没 ship**。

**简历用法对比**：
- ❌ "Built a scene assistant feature"
- ✅ "Shipped a streaming AI scene assistant to production, used by N users daily"

**你需要新增的动作**：每次 PR 合并后，问自己 "这个能写进简历吗？怎么写？"。这会养成 **ship to show off** 的习惯。

---

### Release ⭐

**直白定义**：版本发布。比 ship 更正式，通常带版本号。

**相关概念**：
- **Release notes**：发布说明（告诉用户这版有什么新东西）
- **Hotfix**：紧急修复，跳过正常 release 流程立刻上线
- **Rollback**：回滚，新版本出问题时退回上一版
- **Feature flag**：功能开关，让某个新功能只对一部分用户开放

**你已经在做的事**：CI/CD 自动带版本号。

---

### Cutover ⭐⭐

**直白定义**：切换。从旧系统切到新系统的那个**瞬间**。

**例子**：你 Day 8 的 PR #10（web 切读 v2 + admin 停写 v1 + drop 旧字段）就是一个典型的 cutover。

**核心潜规则**：**永远准备 rollback plan**。任何 cutover 都可能失败，必须事先想好"如果 5 分钟内发现不对，怎么回到原状态"。

**你已经在做的事**：Day 7 立的"跨仓库部署纪律"本质就是一份 cutover playbook。

---

### Playbook ⭐

**直白定义**：操作手册 / 应急预案。描述"在 X 情况下应该按 Y 步骤操作"。

**常见的 playbook**：
- Deployment playbook（发布操作手册）
- Incident response playbook（事故响应预案）
- On-call playbook（值班手册）
- Onboarding playbook（新人入职手册）

**核心价值**：**让任何人在压力下都能做对**。不依赖某个英雄半夜爬起来回忆"上次怎么处理的"。

**你已经在做的事**：SDK 文档、用户文档都写过。

---

## Part 6: 沟通与文化

### OOO ⭐

**Out Of Office**：不在线 / 休假。

**核心潜规则**：**OOO is sacred**（OOO 是神圣的）。

**联系 OOO 同事的正确方式**：
1. 先看 OOO 状态里写的 backup 是谁
2. 联系 backup
3. 实在不行才联系 OOO 本人，且必须先道歉："Sorry to bother you while you're OOO, but..."

**对你的意义**：你将来在国际团队工作，**必须学会捍卫自己的 OOO 时间**。不回消息不是失职，是**专业**。

---

### LGTM ⭐

**Looks Good To Me**：Code review 时的最高频缩写，"我看过了，没问题，可以合"。

**变体**：
- **LGTM with nits**：基本 OK，有几个小建议（nit = nitpick = 吹毛求疵）
- **NIT**：小建议，不是 blocker
- **WAI**：Working As Intended（这就是预期行为，不是 bug）

---

### Crunch mode ⭐⭐

**直白定义**：紧急冲刺模式。真正的 hard deadline 前的加班期。

**和 996 的关键区别**：
- **Crunch mode 是例外**：一年 1-2 次
- **Crunch 后有 comp time**（补休）
- **频繁 crunch 是 management failure**——manager 会被追责

**红旗信号**（面试时要警惕）：
- "We work hard and play hard"
- "We're like a family here"
- "We expect ownership"（配合 24/7 availability）
- 不愿意谈 vacation policy / on-call rotation
- Glassdoor 反复出现 "burnout"

---

### Opinions, not orders ⭐⭐

**直白定义**：一种沟通风格——给出观点，不下命令。

**对比**：
- ❌ "你应该用 Postgres 而不是 MongoDB"
- ✅ "I'd lean towards Postgres because we already have it in the stack. But happy to discuss if you see reasons to consider MongoDB."

**为什么这个风格重要**：让协作流畅、让 junior 有反驳空间、让讨论聚焦于问题而非人。

**配套技能：disagree and commit**。意思是"我不同意这个决定，但既然团队定了，我会全力执行"。这是国际团队的核心成熟度标志。

---

### Async-first ⭐⭐

**直白定义**：默认异步沟通。能写文字就不开会，能 Slack 就不打电话。

**核心原理**：分布在多个时区的团队**没有别的选择**。

**对内向者的意义**：写文字比开会对内向工程师友好得多。**这反过来是亚洲候选人的优势**——你在国内可能因为不擅长开会被低估，到了国际团队反而被重视。

---

### Active listening ⭐⭐

**直白定义**：在回应别人之前，先复述对方的核心意思。

**例子**：
> "You're asking whether RAG is overkill for our three question types. Let me address that directly..."

**为什么重要**：让对方知道"你听懂了"，避免误解。

**你今天体验过的**：我每条消息开头都在复述你的反馈，就是 active listening 的演示。

---

## Part 7: 写作技巧

这一节是国际团队写作的核心方法论。**写作能力 = 异步协作能力 = 远程工作的硬通货**。

### Context first, decision last ⭐⭐

**核心原则**：先讲背景，再讲问题，再讲选项，最后讲决定。

**反模式**（中文常见）："先抛结论再讲为什么"。

**正模式**：
```
1. 背景：当时的情况是什么
2. 问题：我们遇到了什么问题
3. 选项：考虑过哪些方案
4. 决策：选了哪个
5. 理由：为什么选这个
6. 后果：这个选择带来什么
```

**为什么有效**：读者不知道你写的时候在想什么。如果先抛结论，读者第一反应是"等等，问题是什么来着？"——他们带着困惑读后面的内容。

---

### Anticipate the reader's questions ⭐⭐

**核心动作**：写完之后，假装自己是完全不知道上下文的同事，把文档从头读一遍。**每读一句问自己："这里读者会问什么？"** 如果有问题，就在那个位置直接回答。

**例子**：
> 我们决定用 pgvector 而不是 Pinecone。
>
> *(预判读者会问：为什么不用 Pinecone？)*
>
> Pinecone 是更成熟的向量数据库，但我们已经在用 Supabase（基于 Postgres），引入 Pinecone 意味着多一个外部依赖、多一份成本、多一个 failure point。pgvector 是 Postgres 的扩展，可以原地用，对我们当前的规模（256 条记录）完全够用。

**国际团队 ADR 的标准写法**：每一个决策都"自带反驳"——读者还没来得及反驳，你已经回答了。

---

### Make the implicit explicit ⭐⭐

**核心原则**：把暗含的写明白。永远不要假设读者懂。

**例子对比**：
- ❌ 中文式："这个改动只影响 Phase 1。"
- ✅ 国际式："This change only affects Phase 1 (the SQL-based intent routing). Phase 2 (the vector retrieval layer) is not affected because it operates on a separate code path. If you're working on Phase 2, you can ignore this PR."

后一种看起来啰嗦，但**它把读者所有可能的疑问都堵死了**。

---

### TL;DR ⭐

**Too Long; Didn't Read**：长文档开头的一句话总结。

**作用**：让忙的读者**5 秒**内知道核心结论。详细内容留给想深入的读者。

**写法**：
```markdown
# RAG Upgrade Spec

**TL;DR**: We're adding cross-scene retrieval to the Scene Assistant
to handle "what happened before" questions. Two-phase approach:
SQL-based routing first (Day 11-12), vector fallback after (Day 13-14).
Spoiler protection enforced at the data layer, not the prompt layer.
```

---

### Show your work ⭐⭐

**核心原则**：让 reviewer 能追溯每个改动的理由。

**应用场景**：
- 文档修订时，**展示原版 vs 新版**，而不是只展示新版
- PR 中，**注释解释为什么这么改**，而不是只放新代码
- 决策时，**列出 alternatives**，而不是只列最终选择

---

## Part 8: 自查清单

### 每周自查（20 分钟，每周末做一次）

```markdown
## 本周 international team training 自评

### 这周做对的事（不超过 3 件）
- 

### 这周漏掉/做砸的事（不超过 3 件）
- 

### 一个想问 Claude 的问题
- 

### 下周想强化的 1 个动作
- 
```

---

### 每个 PR 自查

- [ ] PR title 用 conventional commits 前缀（feat / fix / chore / refactor / docs）
- [ ] PR description 有 5 段：What / Why / How / Testing / Known limitations
- [ ] **Out of scope** 段已写
- [ ] **Known limitations** 段已写（没有就主动写 "No known limitations at this time."）
- [ ] 有可观察行为时配证据（截图 / GIF / log / live link）
- [ ] 链接相关的 ticket 或 issue
- [ ] 自问："这个 PR 6 个月后我自己回来看能看懂吗？"

---

### 每个重要决策自查

- [ ] 写了 ADR 或 ADR-style note
- [ ] Alternatives 段至少列 2 个被否决的选项
- [ ] 每个 alternative 都有否决理由
- [ ] Consequences 段写了好处和代价
- [ ] 决策记录链接到相关 PR / README / spec

---

### 每个 ticket 自查

- [ ] 有明确的 scope 和 non-goals
- [ ] 有 acceptance criteria（怎么算完成）
- [ ] 有 range estimate（best-case + realistic）
- [ ] 完成时 close the loop（标注后续 follow-up）

---

## 附录：质量分级标准

每个动作有 3 档质量。自评时不只勾✓，还要标档位。

| 档位 | 含义 | PR description 例子 |
|---|---|---|
| 🥉 Bronze | 形式上做到 | 5 段都有，但每段都是套话 |
| 🥈 Silver | 内容真实 | 5 段都有，每段都讲清楚了具体事实 |
| 🥇 Gold | 让 6 个月后的人看懂 | 5 段都有 + 预判读者疑问 + 自带反驳 + 给后续 ticket 链接 |

**进步轨迹目标**：
- Day 10: 大部分 Bronze
- Day 30: 大部分 Silver
- Day 60: 大部分 Gold

---

## 怎么使用这份手册

1. **不要试图一次背完**。把它收藏在 raree-show 项目根目录或 Obsidian。
2. **每天遇到不确定的词，回查一次**。每查一次，记忆就深一层。
3. **每周 retro 时翻一遍 Part 8 的自查清单**，自评一周做到了哪几条。
4. **每月 review 一次目录**，看看哪些概念已经从"陌生"变成"会用"，哪些还需要练。
5. **Day 60 终评时**，把这份手册和你 60 天前的版本对比——你会看到自己学了多少。

---

**Last updated**: Day 10 (2026-04-12)
**Next review**: Day 17 (合并 retro 时)
