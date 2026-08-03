---
layout: post
title: "Codex Auto Router"
subtitle: "多 Agent 协作的可验证、可恢复静态协议"
date: 2026-08-03 00:00:00 +0800
author: "miniLV"
header-img: "img/headers/2026-08-03-codex-auto-router-v2-1.png"
summary: "让 Root 只把边界清晰、可验证、可恢复的工作单元交给一个背景 Agent。"
tags:
    - Codex
    - AI Agent
    - 模型路由
    - 多智能体
    - 软件架构
---

多 Agent 不等于多委派。

Codex Auto Router 是一份完整的静态协议：Root 保留用户意图、计划、授权和最终交付，只在收益严格为正且边界可恢复时交出一个有界工作单元。每个 Main Task 自动考虑一次，但考虑不等于创建 Child；任何不确定都回到 `ROOT_DIRECT`。

[![Root、Luna、Terra 与验证交付的自动路由总流程](/img/in-post/codex-auto-router/routing-overview.jpg)](/img/in-post/codex-auto-router/routing-overview.jpg)
*总流程：Root 决定，单一 Child 执行，Root 验证并交付。*

## 先把协作成本算进去

| 朴素失败 | 静态协议 |
| --- | --- |
| 只看模型强弱 | 同时计算准备、监督、审查和恢复 |
| 把 Child 当黑盒 | 先声明路径、基线与确定性验收 |
| 失败后继续堆委派 | 回到已知基线，再由 Root 接管 |

委派只有在 `expected benefit > packet prep + supervision/review + recovery` 时成立。收益、成本、单位或恢复代价无法比较时，不算 break-even，直接 `ROOT_DIRECT`。微小修改、连续判断、外部动作、无法机械验收的工作，以及依赖 Root 大部分历史的工作，都留在 Root。

## 路由矩阵只有三项

- `ROOT_DIRECT`：Root 当前模型。任一门槛失败、资料缺失、估算不确定，或 ownership、范围、基线、恢复状态有歧义。
- `LUNA_XHIGH_BACKGROUND`：固定 `gpt-5.6-luna / xhigh / fork_turns: none`；仅用于 `READ_LOG_WINDOW` 或 `WRITE_UNIT_TESTS`。
- `TERRA_HIGH_BACKGROUND`：固定 `gpt-5.6-terra / high / fork_turns: none`；用于其他通过全部门槛的 bounded 单元。

同一时刻最多一个 active child。Child 不能创建 descendants、替换 tuple、扩大 ownership；Root 在 Child 活动期间不编辑其独占路径。Dashboard、history、credits、labels 只属于观察信息，不是 Route Decision 输入。

## 九个门槛，缺一项就停

1. 单元 substantial 且 bounded，不改变用户目标或上游流程。
2. 仓库安全，没有 merge/rebase conflict，也没有 ownership 或范围歧义。
3. Worker 的读写路径精确、互斥；只读日志还要有明确时间/行号窗口。
4. 每条可写路径都有委派前捕获的 preflight baseline。
5. 已确认固定 tuple 适合 fresh context。
6. 已写出确定性的验证命令与预期结果。
7. 每条 ownership 路径都能安全 restore 或 discard。
8. Task Packet 含全部事实、约束和禁止事项，脱离 Root 历史也可执行。
9. 预期收益严格大于 packet preparation、supervision/review 与 likely recovery 的总和。

一次决策只返回一个结果，算法只表达边界：

```text
route(mainTask, repoState):
  if competingAuthority or merge/rebase conflict or ambiguity: return ROOT_DIRECT
  unit = findSubstantialBoundedUnit(mainTask)
  if absent or uncertain(unit): return ROOT_DIRECT
  if not allNineGates(unit, repoState): return ROOT_DIRECT
  if unit.action in [READ_LOG_WINDOW, WRITE_UNIT_TESTS]:
    return LUNA_XHIGH_BACKGROUND
  return TERRA_HIGH_BACKGROUND
```

## Luna：两个动作，一个 Child

[![Luna allowlist 的日志读取与测试写入边界](/img/in-post/codex-auto-router/luna-allowlist.jpg)](/img/in-post/codex-auto-router/luna-allowlist.jpg)
*Luna 只读指定日志窗口，或只写指定测试。*

`READ_LOG_WINDOW` 只能读取声明的日志路径和时间/行号窗口，返回事实、指标与证据位置，不扩写设计判断。`WRITE_UNIT_TESTS` 只能写声明的测试路径和测试名，不改生产代码，并报告新旧测试结果。两种动作都不创建后代。

Luna 失败或结果不可验证时，恢复固定为四步：

1. 相对 preflight baseline 解析完整 diff。
2. 独立验证候选变化，只 adopt 有证据的部分。
3. restore 其余路径，清除所有未采纳变化。
4. 记录 resolved post-Luna baseline；只有仍有新的 bounded 残余，才至多创建一次 fresh `TERRA_HIGH_BACKGROUND`，并明确没有未验证的 Luna 变化，否则 Root 直接接管。

## 执行分层：Root 是控制面

[![Root 控制面与 Worker 执行面的分层](/img/in-post/codex-auto-router/execution-layering.jpg)](/img/in-post/codex-auto-router/execution-layering.jpg)
*分层图：Root 保持全链路职责，Worker 只执行声明单元。*

Root 负责解释用户意图、制定计划、决定是否委派、确认授权、声明 ownership、执行外部动作、整合结果、最终验证和交付。Worker 只在独占路径内执行；它的输出是证据，不是自动生效的状态。Root 比对 diff 与 baseline，只采纳已验证结果，其他全部恢复。

## Terra：初次执行，最多两次 focused repair

Terra 先在 fresh context 执行初始 Packet；Root 验证证据、Diff、测试和路径所有权。若只是明确的 focused 缺口，允许同一 Worker、同一 tuple 最多两次 repair follow-up。任意方向错误、越界、不可验证，或两次修复仍未通过，Root 解决路径并接管，不再创建新的 Terra。

## 验证边界

项目静态测试结果为 24/24。
运行时是否真的自动激活仍未被证明。

静态检查只能证明协议文本、固定 tuple、九个门槛、生命周期和禁止项仍然一致；它不能替代受控运行中的真实授权、创建、验证与恢复证据。文章只说明可审查的合同，不把观察标签当成控制面，也不把任何未验证结果写成收益。
