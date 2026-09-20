---
layout: post
title: "Jev Auto Router：让 Codex 在同一会话中逐调用选模型"
subtitle: "Jev 一次 Choice、本地 Responses 代理与任务结束后的独立验收"
date: 2026-09-18 09:00:00 +0800
author: "miniLV"
header-img: "/img/in-post/codex-auto-router/jev-auto-router-per-call.png"
summary: "Jev Auto Router 用 TypeSafe 的 Jev 为 Codex 每次模型调用选择模型与推理档位，再用独立验收检查任务结果。当前仍是逐调用切换的验证原型。"
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

一个编码任务里，难题与例行步骤常常交替出现：理解需求需要仔细推理，读文件、执行明确修改、处理普通工具结果未必需要同一档模型。**Jev Auto Router** 的目标是在**同一个 Codex 会话**中，为每次有意义的模型调用选择合适的 GPT 模型和推理档位，并在任务结束后验证交付是否真的完成。

这里的 [Jev](https://docs.typesafe.ai/introduction) 是 TypeSafe 提供结构化判断的模型。它对已经确定的候选做一次 typed Choice；本地代码负责资格和安全约束，Codex 保持原有会话与工具循环。

> **项目状态：目标架构已确定，运行时仍是验证原型。** 真实 Codex 工具循环中的跨模型切换、完整验收链与节省效果尚未通过端到端验证。本文描述设计及其验证门槛，不是生产安装指南。

源码与决策：[miniLV/Jev-Auto-Router](https://github.com/miniLV/Jev-Auto-Router)（Apache-2.0）· [ADR 0017](https://github.com/miniLV/Jev-Auto-Router/blob/master/docs/adr/0017-per-call-responses-routing.md) · [架构方案](https://github.com/miniLV/Jev-Auto-Router/blob/master/docs/solution.md)

## 使用前提与本地配置

调用 Jev 需要 TypeSafe 账号与 API key，可按[官方 Quick Start](https://docs.typesafe.ai/introduction/quickstart)从控制台获取。

| 项 | 说明 |
| --- | --- |
| `JEV_API_KEY` | 本仓库代理读这个变量调用 Jev |
| `TYPESAFE_API_KEY` | TypeSafe 官方示例常用；可与上面设成同一密钥 |
| Node.js | **22+** |
| Codex CLI | 已登录，且宿主能请求你要路由的模型与 reasoning effort |
| 密钥 | **不要写进仓库** |

```sh
export JEV_API_KEY=your_key_here
# 可选：与官方示例对齐
# export TYPESAFE_API_KEY=your_key_here
# export JEV_API_KEY="$TYPESAFE_API_KEY"
```

拥有密钥并不等于逐调用代理已能接入真实 Codex 会话；后面的 P0 实验必须先通过。当前也**没有**「安装后即可自动路由」的生产路径。

### 本地开发（只验证代码，不接生产代理）

```sh
git clone https://github.com/miniLV/Jev-Auto-Router.git
cd Jev-Auto-Router
npm ci
npm test
npm run typecheck
```

`npm test` 会先构建再跑测试。本地代理入口见仓库 [`src/index.ts`](https://github.com/miniLV/Jev-Auto-Router/blob/master/src/index.ts)。以上命令**不会**把 Codex 接到生产代理。

## 一次调用怎样走完路由

[![Jev Auto Router 逐调用架构：Codex Host、本地代理、Jev、执行门禁、原生 Responses 与独立验收](/img/in-post/codex-auto-router/jev-auto-router-per-call.png)](/img/in-post/codex-auto-router/jev-auto-router-per-call.png)
*目标架构：同一会话内逐调用选择；任务完成后独立验收。*

1. **本地 Responses 代理接住调用。** 它先检查路由是否关闭、是否为基础设施调用、发送给 Jev 的精简状态是否符合隐私规则，再根据宿主实际能力列出可请求的 `(model, reasoning effort)` 组合。
2. **Jev 做唯一的语义选择。** 一次 Choice 同时决定模型与档位。普通候选是 Luna Max、Terra、Sol；GPT-6 默认缺席，只有经过验证的推理阻塞取得临时资格，或用户明确要求，才可能进入本次选择。
3. **执行门禁只校验，不改选。** 确定性代码检查 Jev 返回的组合、权限和当前状态，结果只有 ALLOW 或 DENY。失败、低置信或 DENY 走有记录的预设回退（默认常回 `Terra/medium`）；关闭路由则保留宿主原本指定的模型。
4. **原生执行并记录真实结果。** Responses 调用保持 Codex 的会话与工具循环，流式事件原样返回。日志记录实际执行的模型、档位、用量和回退原因；未观测到的用量保留为 `UNKNOWN`。

这套设计没有「Sol 失败就自动升 GPT-6」的第二个选路器，也不通过任务类型表暗中替 Jev 作决定。Jev 选的是已经合法的候选，门禁验的是这次具体选择能否执行。生产路由钉经过验证的 Jev 固定版本；`jev-latest` 用于 shadow 对比。

说明用序列（**不是实测效果**）：同一会话里 Sol 理清问题 → Luna Max 做明确后续 → Terra 处理一般实现 → Sol 再看失败测试。这只用来说明路由粒度。

## 省模型成本，不能省任务验收

路由器选了便宜模型，并不证明任务做对了。任务结束时，独立验收会回看**原始需求**，检查完整 diff、测试、产物与必要的语义结论；执行模型说「完成了」不算证据。验收使用固定档位，不参与节省型路由。

未通过时，具体失败事实返回**同一个会话**继续修复。默认最多两轮纠错，之后由 Root 接管；重复缺陷、权限问题或范围失控可提前接管。通过验收才算完成交付。

Router Compass 把 Jev 的选择、实际模型与档位、用量、缓存、延迟、回退原因和验收结果关联起来。模型切换可能损失 prompt cache；历史回放也无法证明另一条路径会有同样的质量。因此项目先测量完整成本，再用固定 Terra 对照实验验证是否真的节省，而不会把估算写成已实现的收益。

| 证据 | 可以回答的问题 |
| --- | --- |
| 生产观察 | 实际用了哪些模型、花了多少、任务是否通过验收 |
| 历史回放 | 在明确假设下**估算**其他路线价格；反事实，不证明质量 |
| 固定 Terra 对照 | 同等验收、完整计入 Jev 与纠错开销后，是否真的节省并保持质量 |

## 先过 P0，再谈生产路由

当前仓库有本地代理、路由判断、验收与 Compass 数据结构的原型和测试。最关键的前提仍未得到真实环境证明：**同一个 Codex 工具循环能否安全地在模型 A→B→A 之间切换。** P0 将使用真实 Codex CLI 和四档模型，检查认证、请求与响应中的模型及档位、工具调用 ID、SSE 流式事件、取消、延续与上下文压缩。关键项失败，就停止逐调用方案的生产推进，重新评估宿主接入方式。

仓库里旧版插件 Skill / 封面仍可能反映早期 TaskUnit / worker 架构；**逐调用 V1 以 ADR 0017 与架构方案为准。**

在 P0 和受控对照完成前，我不会声称它已经能开箱即用，或已经证明普遍节省。欢迎 Star、Issue，以及对照实验的拍砖。
