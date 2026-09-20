---
layout:     post
title:      "有界委派，而不是把验收权一起交出去：Jev Auto Router 的设计笔记"
subtitle:   "门，不是甩锅：Capsule → Jev → Policy Guard → Root"
date:       2026-09-20 22:00:00
author:     "miniLV"
summary:    "把有界、可验证的实现单元过一道门，验收权仍留在 Root。诚实边界：自动委派默认关闭。"
tags:
    - Codex
    - Agent
    - 开源
    - 可审计
    - 委派
    - Jev Auto Router
---

- 掘金原文：https://juejin.cn/spost/7687015527131168783
- 仓库：https://github.com/miniLV/Jev-Auto-Router（Apache-2.0）

---

## 1. 一次具体的「贵」

用 Codex 做正经工程，真正烧配额的时刻，常常不是架构争论。

更常见的是：改动范围已经界定好了——要动哪些路径、接口怎么长、验证命令是什么——却仍在旗舰会话里亲手敲完、跑完、看失败、再改一遍。判断早已完成，机械活还在占着最贵的上下文。

我开源了 **Jev Auto Router**：面向 Codex 的**可恢复、可审计**委派插件。它想回答的不是「怎么把更多活甩给子代理」，而是：

> 怎样把**有界、可验证**的实现单元过一道门，同时让验收权仍留在 Root。

一句话：**Jev 负责选路；Policy Guard 只有 ALLOW / DENY；Codex 执行；Root 验证与验收。**

---

## 2. 架构动机：门，不是甩锅

委派系统最容易翻车的地方，往往不在「选了哪个模型」，而在这三件事叠在一起：

1. **边界含糊** — 子任务没有明确 owned paths / 成功标准 / 验证命令，失败后无法机械判定。
2. **治理可改道** — 策略层不仅能否决，还能静默换一条路，审计时对不上「当初为什么这样执行」。
3. **失败不可恢复** — 子代理把工作区改脏了，Root 只能在脏状态上继续猜。

所以插件把流程钉成四步，且每一步都有「不做的事」：

| 步骤 | 做什么 | 刻意不做 |
|------|--------|----------|
| Task Capsule | Root 写清有界交接包 | 不把整段 Root 对话复制给 worker |
| Jev | 前置满足时一次 typed Choice → RoutePlan | 不在仓库里塞启发式选路表 |
| Policy Guard | 只输出 `ALLOW(RoutePlan)` 或 `DENY → Root` | 不静默改道、不替换模型、不降级冒充通过 |
| 执行 + 验收 | `spawn_agent` + Root 机械验证；失败先恢复 baseline | 不采信 child 自报「我测过了」 |

同时只有一个 active child；硬预算；每次路由尝试落 **Decision Receipt**（证据，不是控制面）。本地 Dashboard / `ccusage` **只观察，永不回流进路由**——观测可以很热闹，但不能反过来当方向盘。

---

## 3. Task Capsule：经济边界，不是文档堆

Capsule 是 Root 为**一个实现单元**写的交接包。它是经济边界：该写清的必须写清，但不该把整段旗舰上下文塞进去。

面向 worker 的投影是五段规格，外加结构化 RETURN 字段。母稿强调的三条**机械检查**是委派许可的硬门槛：

1. **路径可解析** — owned paths 在仓库里说得清，而不是「相关文件随便找」。
2. **验证命令已预跑** — 成功标准对应的命令，在委派前 Root 侧已经能跑通（或明确基线结果），而不是委派后再发明怎么验。
3. **baseline 已存** — 每个可写路径在 dispatch 前有快照；失败时恢复有据可依。

设计取舍很直白：宁可让 Capsule 难填、难过门，也不要「口头委派」。过不了三条检查，就不应进入自动委派；今天在资格未冻结时，这会自然落到 Root 路径——这不是旁路，而是契约的一部分。

适用：改动面清楚、验证可脚本化、副作用类别可声明的实现单元。  
不适用：需求仍在摇摆、授权边界不清、需要大量跨模块探索才知道「动哪里」的任务——这类应留在 Root，而不是硬塞进 Capsule。

---

## 4. Jev 与 Policy Guard：选路 vs 否决

**Jev** 是唯一的自动选路智能：在前置条件满足时，一次 typed Choice 产出 RoutePlan（含是否 root、模型与 effort、agent / Skills / MCP / 工具范围、上下文与续跑策略等）。超时、坏输出、低置信——回 Root。仓库侧不维护另一套「形状启发式」或「固定车道表」去抢决策。

**Policy Guard** 是确定性校验器。它的权力被故意削窄：

- 结论空间只有两个：`ALLOW(RoutePlan)`，或 `DENY(reason) → Root`。
- **只有否决权，没有改道权** — 不能把 DENY 偷偷换成「另一个看起来差不多的计划」。
- 不选择、不替换、不降级冒充通过。

这是次轴卖点，也是审计友好的关键：Receipt 里能看到「计划是什么、Guard 说了什么」，而不是事后发现执行路径与计划不一致却无人负责。

Root 条件本身也有门槛：自动路由需要可信的当前任务证据，Root 为 `gpt-6-astra` 或 `gpt-5.6-sol` 且 Medium+（以及更高档位）；其它或未验证元组意味着走 Root 直办。需要：支持插件的当前 Codex CLI，以及 `spawn_agent`。

---

## 5. 失败恢复路径：先 baseline，再谈纠正

执行走 Codex 原生 `spawn_agent`。Root 的采纳门是**机械验证**：读完整 diff、确认范围、重跑可能受影响的验证命令——**从不**被 child 自报满足。

若结果失败或被拒：

1. **先恢复 baseline**（dispatch 前对可写路径的快照）——把工作区从脏状态拉回已知点。
2. 再决定：同工人纠正（仅当运行时证据能证明续跑句柄与身份契约）、重新委派，或 Root 接手。
3. 风险触发时，可走有界的语义 review（对持久候选最多一次量级，且受执行预算约束），结论是 `ACCEPT` / `REVISE` / `RECONSIDER` 这类离散判断，而不是散文式「感觉还行」。

「失败先回 baseline」不是文案修饰，而是把委派从「赌一把工作区」变成「可回滚的实验」。没有这一步，可恢复只是口号。

硬预算与「同时一个 active child」限制了并发失控：经济上可预期，审计上也不会出现多条委派互相踩踏却说不清谁先谁后。

---

## 6. 诚实边界（请先读，再决定要不要装）

这是**架构预览**。

- 运行时 Modules 已落地，并有测试。
- **真实 host 证据与 benchmark 资格仍未验证**。
- 因此 **自动委派默认关闭**：`DENY(PROFILE_UNQUALIFIED)`。
- 今天装上，你仍然可以按 Policy 走 **Root 路径**：契约在，委派先关。
- 在资格冻结前，**不宣称「已普遍省配额」**，也不讲未验证的效果数字。

把默认关写进安装说明，不是谦虚表演，而是防止读者把「架构可委派」误读成「今天已经在普遍代打」。能诚实说清「门已焊好、钥匙还没发」，比多写两句营销有用。

---

## 7. 30 秒上手

```sh
codex plugin marketplace add miniLV/Jev-Auto-Router --ref master
codex plugin add jev-auto-router@jev-auto-router
```

任务里也可显式点名：

```text
Use $jev-auto-router:jev-auto-router to implement <feature> and verify it.
```

可选：本地观察面板（只观察）、测试与 typecheck——具体脚本以仓库 README 为准。

---

## 8. 适用 / 不适用（归档用 checklist）

**更可能适合**

- 实现单元边界清晰，owned paths 可列尽。
- 验证命令稳定、可重复，Root 愿意在委派前预跑。
- 能接受「过不了门就留在 Root」，而不是追求「总能自动委派」。
- 需要 Decision Receipt 做事后审计，而不是只看最终 diff。

**更应留在 Root**

- 需求或授权仍模糊。
- 副作用大、且 baseline 难以覆盖（例如不可逆外部动作）。
- 必须大量探索才能知道改哪里——此时强行 Capsule 只会制造假边界。
- 当前环境不满足 Root 模型/档位或缺少 `spawn_agent`。

---

## 9. 系列索引建议（后续可写什么）

1. **Capsule 五段怎么填才过三条机械检查**（带一份「过门 / 不过门」对照表，仍不承诺省配额）。
2. **Policy Guard 否决理由怎么读**：常见 `DENY` 原因与对应的 Root 处置。
3. **baseline 恢复在真实仓库里的操作笔记**（失败路径 walkthrough）。
4. **Decision Receipt 字段解读**：哪些是证据、为什么不能回流成路由输入。
5. **资格冻结之前：观察窗口里只记录、不执行委派**——等有 host 证据再写，不提前剧透效果。

（小红书向可拆成更短的「场景条」：例如「改一个 API 路径时 Capsule 怎么写」。）

---

## 10. 结尾

Jev Auto Router 想守住的，是一条很窄的原则：**委派可以有界，验收必须可恢复、可审计；Policy 可以否决，但不许静默改道。**

今天自动委派默认关。契约与 Root 路径可用。仓库与掘金文都在，欢迎 Star、Issue：哪些场景应强制留在 Root、Capsule 哪一段最难填——欢迎拍砖。

- GitHub：https://github.com/miniLV/Jev-Auto-Router  
- 掘金：https://juejin.cn/spost/7687015527131168783
