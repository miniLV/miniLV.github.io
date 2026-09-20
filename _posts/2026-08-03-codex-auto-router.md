---
layout: post
title: "Jev Auto Router"
subtitle: "自动路由策略 + Root 最终验收：有界委派，而不是把验收权一起交出去"
date: 2026-08-03 00:00:00 +0800
author: "miniLV"
header-img: "img/headers/2026-08-03-codex-auto-router.png"
summary: "Capsule → Jev 选路 → Policy Guard 只 ALLOW/DENY → Codex 执行 → Root 机械验收。自动委派默认关，契约与 Root 路径可用。"
tags:
    - Codex
    - AI Agent
    - 模型路由
    - Jev Auto Router
    - 可审计
    - 委派
---

现在的 GPT 模型越来越能做复杂工作，单次调用的价格也随之拉开差距。对一段需要理解业务、判断风险、整合结果的任务，直接用最强模型当然最省心；但把同一档能力用在边界已经清楚、结果可以机械验收的实现单元上，长期看并不划算。

真正烦人的往往不是「有没有更便宜的模型」，而是：**每接一个任务，都要在成本、质量和上下文之间重新做一遍切档判断**。任务一多，切换本身就成了新工作；切错了，省下的额度会在返工里吐回去。

[Jev Auto Router](https://github.com/miniLV/Jev-Auto-Router) 想把这件事收成一条可审计流水线：

> **Jev 负责选路；Policy Guard 只有 ALLOW / DENY；Codex 执行；Root 验证与验收。**

一句话：**把有界、可验证的实现单元过一道门，验收权仍留在 Root。**

这篇只聊两块重点：**Jev 的自动路由策略**，以及**最后的验收（含失败恢复）**。完整安装与策略文档见仓库 README；掘金母稿：[有界委派，而不是把验收权一起交出去](https://juejin.cn/spost/7687015527131168783)。

[![Root 决定，单一 Child 执行，Root 验证并交付](/img/in-post/codex-auto-router/routing-overview.jpg)](/img/in-post/codex-auto-router/routing-overview.jpg)
*总流程不变：Root 决定，同一时刻最多一个 Child 执行，Root 验证并交付。*

---

## 真正的成本，不在模型调用那一下

| 朴素失败 | 静态协议 |
| --- | --- |
| 只看模型强弱 | 同时计算准备、监督、审查和恢复 |
| 把 Child 当黑盒 | 先声明路径、基线与确定性验收 |
| 失败后继续堆委派 | 回到已知基线，再由 Root 接管 |

一次委派不是一次函数调用。Root 要写清交接包、划清写入范围、给出验收命令；Child 回来后，还得看完整 diff、重跑验证、处理没被采纳的改动。把这些都算上，委派只有在下面这个式子严格成立时才值得：

`expected benefit > packet prep + supervision/review + recovery`

数字缺失、单位没法比较、恢复代价说不清，都不叫「差不多能赚」——门不开，留在 Root。小改动、需要连续判断的工作、外部动作、验收只能靠感觉的工作，也都别硬拆。

---

## 自动路由策略：Capsule → Jev → Policy Guard

### 1. Task Capsule：经济边界，不是文档堆

Capsule 是 Root 为**一个实现单元**写的交接包。面向 worker 的投影是五段规格，外加结构化 RETURN。三条**机械检查**是委派许可的硬门槛：

1. **路径可解析** — owned paths 在仓库里说得清。
2. **验证命令已预跑** — 成功标准对应的命令，在委派前 Root 侧已经能跑通（或明确基线结果）。
3. **baseline 已存** — 每个可写路径在 dispatch 前有快照；失败时恢复有据可依。

宁可让 Capsule 难填、难过门，也不要「口头委派」。过不了三条检查，就不应进入自动委派。

### 2. Jev：唯一的自动选路智能

前置条件满足时，Jev **一次** typed Choice 产出 **RoutePlan**（是否走 Root、模型与 effort、agent / Skills / MCP / 工具范围、上下文与续跑策略等）。

关键约束：

- **一次选路，不是便宜→贵爬坡**。超时、坏输出、低置信 → 回 Root。
- 仓库侧**不**另塞一套「形状启发式」或「固定车道表」去抢决策。
- Dashboard / `ccusage` **只观察，永不回流进路由**——观测可以很热闹，但不能反过来当方向盘。
- 同一时刻最多一个 active child；硬预算；每次路由尝试落 **Decision Receipt**（证据，不是控制面）。

Root 条件本身也有门槛：自动路由需要可信的当前任务证据，Root 为约定旗舰档位（如 `gpt-6-astra` / `gpt-5.6-sol` 且 Medium+）；其它或未验证元组意味着走 Root 直办。需要：支持插件的当前 Codex CLI，以及 `spawn_agent`。

### 3. Policy Guard：只有否决权，没有改道权

Policy Guard 是确定性校验器。结论空间故意削窄成两个：

- `ALLOW(RoutePlan)`
- `DENY(reason) → Root`

它**不选择、不替换、不降级冒充通过**。DENY 不能偷偷换成「另一个看起来差不多的计划」。审计友好的关键：Receipt 里能看到「计划是什么、Guard 说了什么」，而不是事后发现执行路径与计划不一致却无人负责。

把整条策略压成伪代码，大致是：

```text
route(task, repoState):
  capsule = buildTaskCapsule(task)          # 五段 + RETURN
  if not mechanicalGates(capsule):          # 路径 / 预跑验证 / baseline
    return ROOT_DIRECT
  plan = jev.chooseOnce(capsule)            # typed Choice → RoutePlan
  if plan.timeout or bad or lowConfidence:
    return ROOT_DIRECT
  decision = policyGuard(plan, capsule)     # ALLOW | DENY only
  if decision is DENY:
    return ROOT_DIRECT                      # 不改道
  return ALLOW(plan)                        # spawn_agent 执行
```

[![Root 控制面与 Worker 执行面的分层](/img/in-post/codex-auto-router/execution-layering.jpg)](/img/in-post/codex-auto-router/execution-layering.jpg)
*分层：Root 保持全链路职责；Worker 只执行声明单元。*

---

## 最后的验收：Child 只是候选，Root 说了算

这是整套设计里最容易被忽略、也最不该省的一步。

Child 的输出**不是**「已经生效的改动」，而是一份**候选结果**。Root 的采纳门是**机械验证**，不是信任自报：

1. **读完整 diff**（相对 dispatch 前 baseline）。
2. **确认范围** — 是否落在 owned paths；有没有越权改动。
3. **重跑可能受影响的验证命令** — 与 Capsule 里预声明的成功标准对齐。
4. **只采纳已通过验证的部分**；其余恢复。

**从不**被 child 自报「我测过了」带过。这个动作有点笨，但它避免了「子 Agent 看起来做完了，仓库却多了一堆没人说得清的变化」。

### 失败恢复：先 baseline，再谈纠正

若结果失败或被拒：

1. **先恢复 baseline**（dispatch 前对可写路径的快照）——把工作区从脏状态拉回已知点。
2. 再决定：同工人纠正（仅当运行时证据能证明续跑句柄与身份契约）、重新委派，或 Root 接手。
3. 风险触发时，可走有界的语义 review（对持久候选最多一次量级，且受执行预算约束），结论是离散的 `ACCEPT` / `REVISE` / `RECONSIDER`，而不是散文式「感觉还行」。

「失败先回 baseline」不是文案修饰，而是把委派从「赌一把工作区」变成「可回滚的实验」。没有这一步，可恢复只是口号。

硬预算与「同时一个 active child」限制了并发失控：经济上可预期，审计上也不会出现多条委派互相踩踏却说不清谁先谁后。

---

## 诚实边界（请先读，再决定要不要装）

这是**架构预览**。

- 运行时 Modules 已落地，并有测试。
- **真实 host 证据与 benchmark 资格仍未验证**。
- 因此 **自动委派默认关闭**：`DENY(PROFILE_UNQUALIFIED)`。
- 今天装上，你仍然可以按 Policy 走 **Root 路径**：契约在，委派先关。
- 在资格冻结前，**不宣称「已普遍省配额」**，也不讲未验证的效果数字。

能诚实说清「门已焊好、钥匙还没发」，比多写两句营销有用。静态测试通过，只证明策略文本与生命周期约束一致；**不等于**运行时一定自动创建正确的 Child，也不等于真实平台上的授权、恢复和 fallback 都已跑对——那部分必须用受控试运行拿证据。

我更看重的也正是这点：**自动路由的价值，不是让更多任务离开 Root，而是让每一次离开都有边界、有基线，也有回来的路；最后一锤，永远是 Root 的机械验收。**

---

## 30 秒上手

```sh
codex plugin marketplace add miniLV/Jev-Auto-Router --ref master
codex plugin add jev-auto-router@jev-auto-router
```

任务里也可显式点名：

```text
Use $jev-auto-router:jev-auto-router to implement <feature> and verify it.
```

完整实现、策略文档与测试：[miniLV/Jev-Auto-Router](https://github.com/miniLV/Jev-Auto-Router)（Apache-2.0）。延伸阅读：[Artificial Analysis 对 GPT-5.6 的 Intelligence、Speed 与 Cost 分析](https://artificialanalysis.ai/articles/gpt-5-6-has-landed/)。
