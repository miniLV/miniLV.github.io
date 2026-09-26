---
layout: post
title: "Jev × Codex：逐调用模型路由技术设计"
subtitle: "同一个会话、同一个工具循环，每次模型调用由 Jev 选择模型与推理档位"
date: 2026-09-18 09:00:00 +0800
author: "miniLV"
header-img: "/img/in-post/codex-auto-router/jev-auto-router-per-call.png"
summary: "Jev Auto Router：同一 Codex 会话里，每次模型调用由 TypeSafe Jev 在 GPT-6（luna / sol / astra）候选对中做一次受约束 Choice；Guard 通过后只改 model 与 reasoning.effort，其余请求与 SSE 原样转发。"
tags:
    - Jev Auto Router
    - Jev
    - Codex
    - LLM Router
    - 模型路由
    - AI Agent
redirect_from:
    - /2026/08/03/codex-auto-router/
---

一个编码任务里，难题与例行步骤常常交替出现：理解需求、定位故障需要仔细推理；读文件、执行明确修改、处理普通工具结果，未必需要同一档模型。

**Jev Auto Router** 要做的事情可以一句话说清：在**同一个 Codex 会话**里，为每一次模型调用选择合适的 GPT 模型与推理档位。会话不拆、工具循环不变，变的只是每次请求里的 `model` 和 `reasoning.effort` 两个字段。

这里的 [Jev](https://docs.typesafe.ai/introduction) 是 TypeSafe 提供结构化判断的服务：它对一组已经合法的候选做一次 typed Choice；本地代码负责资格准入、安全约束和最终执行。工具执行始终由 Codex 管理，Jev 不成为 Codex 的执行模型。

> **当前状态：** 方案 A 运行时已落地（固定基线 / Shadow·Active / Guard·Apply / 取消传播等，确定性 HTTP 测试通过）。真实可重跑的 Codex 跨模型工具循环（A→B→A）、独立取消与配对评估发布结论仍在补证据。本文整理自仓库[可视化技术设计稿](https://github.com/miniLV/Jev-Auto-Router/blob/master/tech-design.html)，描述目标架构；模型阵容以仓库 README 为准（当前为 **GPT-6**：`gpt-6-luna` / `gpt-6-sol` / `gpt-6-astra`）。

源码与决策记录：[miniLV/Jev-Auto-Router](https://github.com/miniLV/Jev-Auto-Router)（Apache-2.0）· [ADR 0017](https://github.com/miniLV/Jev-Auto-Router/blob/master/docs/adr/0017-per-call-responses-routing.md) · [架构方案](https://github.com/miniLV/Jev-Auto-Router/blob/master/docs/solution.md)

当前候选是精确的 `(model, reasoning_effort)` 对，不是品牌口头档。仓库 README 里的 GPT-6 阵容是：`gpt-6-luna`（高强度推理）、`gpt-6-sol`（常规主力与固定回退基线角色）、`gpt-6-astra`（默认不在候选中，仅在证据或用户指令准入时进入）。模型选择器里「看得见」不等于 caller edge 上可执行。

<br>

## 一次调用走哪条路

![系统拓扑：Codex CLI、Codex Router、Jev Router、认证 caller edge 与 GPT 模型的主链路，TypeSafe Jev 作为路由决策支线](/img/in-post/codex-auto-router/jev-topology.png)

主线只处理 Codex 原生的 Responses 请求，一共五站：

- **Codex CLI（HOST）**：保留一个会话与工具循环，请求目标是虚拟模型 `jev/auto`；
- **Codex Router（本地入口）**：识别 `jev/auto`，把 Responses 请求交给本地 Jev Router；
- **Jev Router（决策 + 应用）**：提取准许发送的事实、构造候选、校验选择，只改 `model` 与 `reasoning.effort`；
- **Caller edge（认证出口）**：用已验证的原生认证通道发送真实模型请求，禁止再次路由到 `jev/auto`；
- **GPT 模型（执行）**：实际执行本次调用，SSE 响应沿原路即时返回 Codex。

TypeSafe Jev 挂在支线上（图中虚线）：接收白名单状态与可用的 `(model, effort)` 候选，返回一个选择及置信度。它不接收完整请求、工具输出或认证凭据。

三条边界约束是这个拓扑成立的根基：

1. **用户内容只走主线**：原始文本与工具结果只通过本地代理到达它原本要去的 GPT 上游；
2. **Jev 支线只携带白名单事实**：送出去的是结构化路由状态，不是对话内容；
3. **入口与出口分开**：虚拟模型入口 `jev/auto` 与认证 caller edge 是两个边界，转发的请求禁止再指回 `jev/auto`，避免递归转发。

<br>

## 六个模块，各自负责什么

![Jev Router 六个模块：请求接入、候选与隐私、一次 Jev Choice、校验并应用、认证与流转发、被动观测](/img/in-post/codex-auto-router/jev-modules.svg)

接口尽量小：决策、实际执行和观测分开，避免在 Jev 之外冒出第二个隐藏的选模器。几个设计意图值得单独说：

- **Jev 只被问一次。** M3 用固定版本、固定问题模板做一次有截止时间的调用，超时或失败直接走回退，不存在「再问一次换个答案」。
- **Guard 只校验，不改选。** M4 检查候选成员、当前可用性、用户约束和置信度阈值，全部是确定性检查；通过后才由 Apply 覆盖请求里的两个字段。
- **观测是旁路。** M6 记录 Jev 提议的组合、实际应用的组合和上游报告的真实模型，缺失值标为 `UNKNOWN`，不记录原文；观测失败不阻断、也不改写 Codex 收到的响应。

<br>

## Codex 与 Jev 怎样交互

![Codex、Codex Router、Jev Router、TypeSafe Jev 与 caller edge 的逐调用交互时序图](/img/in-post/codex-auto-router/jev-sequence.png)

一次调用的完整旅程：Codex 发出 `Responses(model=jev/auto)` → Codex Router 转交本地入口 → Jev Router 送出白名单事实与候选组合 → Jev 返回 `pair_id + confidence` → Guard 校验、Apply 只写 `model / effort` → 真实模型请求发给认证 caller edge → 原生 SSE / JSON 即时回传。

两个容易被忽略的点：

- **响应不等整段生成完成。** SSE 事件边到边回传，观测模块旁路读取完成事件；
- **工具之后重新路由。** Codex 执行工具产生的新模型调用会再走一遍完整路由。路由粒度是「每次模型调用」，不是「每个任务」。

<br>

## 业务流程：从用户任务到交付

![Jev 自动路由的业务流程：准入检查、构造候选与事实、Jev 选择组合、Guard 与 Apply、认证上游执行、工具结果回到下一轮](/img/in-post/codex-auto-router/jev-flow.svg)

三种情况根本不进 Jev：路由关闭（OFF）、用户手动固定模型、基础设施调用，直接走确定性直通。隐私检查不过、Jev 失败、选择无效或置信度不足，都在**发出上游请求之前**回退到事先验证的固定组合。

反过来，如果上游已经开始输出，网络中断就直接作为该次调用失败上报，不在同一调用上自动换模型重放——避免重复计费和不可预期的半截响应。

任务结束时的质量验收使用任务产物，不用模型自报。

<br>

## 路由怎么决定，怎么 Apply

**Jev 之前：候选集合与输入**

- **可用组合**：来自认证通道实际可请求的模型与 effort；每个候选是完整的 `(model, effort)` 对，模型和档位不分开拼接。
- **硬约束**：用户手动固定模型直接执行；基础设施调用使用固定组合；不符合能力与可用性要求的组合先排除。
- **送给 Jev**：调用类型、当前模型、上下文区间、工具名称与状态、错误类别等白名单事实；任务摘要只有明确允许发送时才可加入。
- **不送 Jev**：原始用户文本、工具输出、完整会话、代码文件内容与认证信息。

**Jev 之后：校验、回退与记录**

- **Jev 回答**：一个候选 pair ID 与置信度。
- **Guard**：检查 pair ID 属于当前候选、模型仍可请求、用户约束未被覆盖、置信度达到已校准阈值。
- **失败回退**：使用事先验证、且在当前 caller edge 上已实测可请求的固定基线（例如 `gpt-6-sol/medium`；**没有产品级默认组合**，须显式配置 `JEV_BASELINE`）；不可用则在发送前明确失败；用户固定模型不会被回退降级。
- **记录**：区分 Jev 提议、实际应用和上游报告的真实模型；未知用量保留 `UNKNOWN`。

Apply 前后，请求长这样（示意）：

```json
// Codex 发出的请求
{
  "model": "jev/auto",
  "reasoning": { "effort": "medium" },
  "input": "…",
  "tools": ["…"],
  "stream": true
}
```

```json
// Apply 后发给 caller edge
{
  "model": "gpt-6-sol",
  "reasoning": { "effort": "high" },
  "input": "…",
  "tools": ["…"],
  "stream": true
}
```

Apply 合约只有一行：

```ts
routed = { ...request, model: chosen.model, reasoning: { ...request.reasoning, effort: chosen.effort } }
```

`input`、工具定义、工具调用 ID、`stream` 标记与其余请求字段原样保留，`service_tier` 不暗中改写。

<br>

## 请重点 Review 的三个决定

### R1 · 认证 caller edge 的契约

确认验证通过的是哪个版本和入口；明确认证归属、请求头转发、取消传播，以及 caller edge 升级时的兼容测试。这个入口必须绕开 `jev/auto` 再路由，否则拓扑里「入口与出口分开」的约束就破了。

### R2 · 隐私与决策信息量

在不发送原文的前提下，哪些结构化事实足以让 Jev 区分「简单跟进」和「困难推理」？如果事实不足，该次调用就使用可靠组合，并在 shadow 数据中量化这个比例——用数据回答「白名单到底够不够用」。

### R3 · 激活标准

先在 shadow 模式记录延迟、提议组合和故障；再用相同任务与验收标准做配对执行，成本计入 Jev 调用、缓存损失与返工。只有质量达标，才讨论总成本收益。

<br>

## 上手试试

前提：[TypeSafe 账号与 Jev API key](https://docs.typesafe.ai/introduction/quickstart)、Node.js 22+、已登录的 Codex CLI。

| 环境变量 | 说明 |
| --- | --- |
| `JEV_API_KEY` | TypeSafe Jev 密钥，启用路由时必填（不要写进仓库） |
| `JEV_UPSTREAM_BASE_URL` | 认证 caller edge 地址（不会递归回到本路由器） |
| `JEV_BASELINE` | 当前 edge 已实测可请求的固定回退组合，如 `gpt-6-sol/medium`（必填，无通用默认） |
| `JEV_ROUTER_OFF` | `1` = OFF 模式：不调用 Jev，`jev/auto` 用固定基线 |
| `JEV_PORT` | 本地代理端口，默认 `8787` |

```sh
git clone https://github.com/miniLV/Jev-Auto-Router.git
cd Jev-Auto-Router
npm ci
npm test          # 先构建再跑全部测试
export JEV_API_KEY="<your-key>"
export JEV_BASELINE="gpt-6-sol/medium"   # 换成你在该 caller edge 上已验证的组合
export JEV_UPSTREAM_BASE_URL="<authenticated-caller-edge-url>"
npm start         # 默认 Shadow；仪表板 http://127.0.0.1:8787
curl -s localhost:8787/health   # 路由状态、基线档位、模型目录
```

完整配置表与 Active 门禁见仓库 [README](https://github.com/miniLV/Jev-Auto-Router#配置)。

代理暴露 `POST /v1/responses`：`model=jev/auto` 触发逐调用路由，真实模型直接透传。访问 `http://127.0.0.1:8787/install` 可生成一份交给 Codex 执行的安装简报，把外部 Codex Router 的 `jev/auto` 指到本地代理，全部改动可回滚。

<br>

## 写在最后

这套设计最重要的取舍，是把「语义判断」和「执行安全」彻底分开：Jev 负责在一次受约束的选择里给出专业判断，本地代码负责让它永远只能在合法候选里选、失败永远有回退、用户固定永远不被降级。路由器自己不偷偷做第二个决策。

设计稿与详细方案见仓库：[tech-design.html](https://github.com/miniLV/Jev-Auto-Router/blob/master/tech-design.html)。外部参考：[Gist 拓扑](https://gist.github.com/antoniolg/62f82f2a5d191fe074e3f5065501993d) · [TypeSafe 置信度路由](https://docs.typesafe.ai/patterns/confidence-routing) · [Codex 配置](https://learn.chatgpt.com/docs/config-file/config-reference)。

欢迎 Star、Issue，以及对照实验的拍砖。
