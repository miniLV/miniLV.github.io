---
layout: post
title: "Codex Auto Router v2.1：把模型路由做成一份可验证的静态协议"
subtitle: "从自动评估、任务包到失败恢复，完整拆解 Root、Luna 与 Terra 的协作边界"
date: 2026-08-03 00:00:00 +0800
author: "miniLV"
header-img: "img/headers/2026-08-03-codex-auto-router-v2-1.png"
summary: "Codex Auto Router v2.1 将自动路由收敛为一份静态协议：Root 保留最终权力，背景子任务必须通过可验证的门槛，并在失败时恢复到已知基线。"
tags:
    - Codex
    - AI Agent
    - 模型路由
    - 多智能体
    - 软件架构
---

“把任务交给更合适的模型”听起来像一个分类问题，实际更像一个协作成本问题。

只要存在任务拆分，就会同时出现任务包准备、上下文交接、过程监督、结果审查和失败恢复。一个模型是否更快、更便宜，不能脱离这些成本单独讨论。Codex Auto Router v2.1 的核心不是再做一个模型选择器，而是回答一个更窄的问题：**什么时候值得让 Root 暂时交出一个边界清晰、可恢复的工作单元？**

这个版本把答案写成一份可以审查的静态协议。每个 Main Task 自动被考虑一次，但“考虑”不等于“委派”；只有通过全部门槛，才可能创建一个原生子 Agent。没有通过时，Root 直接完成任务。

<br>

## 路由首先是协作决策

### 不是“哪个模型更强”

模型路由常被画成 任务 -> 分类器 -> 模型。这张图忽略了一个事实：子 Agent 不是一个纯函数调用，它会拥有一段时间的上下文和可能的写权限。Root 要把事实、约束、禁止事项、基线和验收方法装进任务包，还要在任务结束后检查它是否真的完成。

所以路由收益必须和协作成本放在同一单位里比较：

~~~
预期收益 > 任务包准备 + 监督/审查 + 可能的恢复
~~~

这个比较是严格的。估算缺失、单位不可比或结果存在重大不确定性，都不能算作正 break-even，选择 ROOT_DIRECT。微小修改、连续判断、外部动作、无法机械验证的工作，以及必须依赖 Main Task 大部分历史的工作，也留在 Root。

### v1 的两个边界

v1 只在用户明确要求时才考虑委派，而且所有背景执行都使用 Terra。这种做法容易理解，却留下两个结构性缺口：第一，自动化任务始终要额外写出“请委派”的意图，无法把一次安全的自动评估作为默认流程；第二，Terra 成为唯一背景出口，既不能表达“只读取一段日志”这种低风险特例，也不能把单元测试写入和普通修复区分开来。

这里不虚构任何速度或成本指标。v1 的问题不是已经测出某个百分比损失，而是协议本身无法描述这些边界，也没有一个明确的失败后恢复合同。v2.1 先把形状、所有权和证据写清楚，再让受控试运行提供数据。

<br>

## v2.1 的结构：一个深 Module，三类协作边界

架构图里的四个标签对应不同的责任深度：

![Codex Auto Router v2.1 完整架构图](/img/codex-auto-router/codex-auto-router-v2-1-architecture.png)

- **Module：** routing-policy.md 是唯一的深运行时 Module，拥有路由资格、固定 route tuple、stand-down 规则和 fallback。其他文档不能覆盖它。
- **Interface：** Route Decision 和 Task Packet 是接口。前者只能返回三个决定，后者描述一次完整、可恢复的 Worker 合同。
- **Seam：** 原生子 Agent 的创建、结果收集、独立验证和所有权转移是 Lifecycle Seam。它连接 Root 和执行者，但不自行选择模型。
- **Adapter：** SKILL.md 与 openai.yaml 是浅 Adapter。它们暴露“允许自动考虑”等入口，不复制路由表，也不实现控制流。

Dashboard 是独立的只读观察者，只显示历史、credits 和标签等信息。它不是路由输入，也不是控制面；这些数据永远不能影响 Route Decision。

因此系统里没有 engine、classifier、registry、路由 LLM、telemetry，也没有 src/router 或 Dashboard 控制路径。静态协议是可以阅读、测试和审查的约束，不是一个常驻服务。

<br>

## Root 保留什么权力

Root 仍然拥有用户意图、计划、需要高判断力的决策、外部动作、结果整合、最终验证和交付。自动路由只改变其中一个有边界的执行单元；它不改变用户授权，也不绕过上游 Skill。

Root Model 永远不变。文档中的 Sol Medium 只是外部部署假设，不是一个路由，也不是 Root model override。Root 在下面三种情形必须 stand down 到 ROOT_DIRECT：

1. 另一个活动中的 routing 或 orchestration authority 正在治理同一任务；
2. 仓库存在活动的 merge 或 rebase conflict；
3. 所有权、范围、基线或恢复状态存在歧义。

这三条不是“遇到异常再看看”，而是委派前的硬停止条件。竞争的权力来源越多，自动路由越应该保持安静。

<br>

## 一次决策的完整算法

自动评估只运行一次，然后返回恰好一个决定。下面的伪代码省略平台调用细节，只保留协议边界：

~~~
route(mainTask, repoState):
    if competingAuthority(repoState)
       or mergeOrRebaseConflict(repoState)
       or ambiguousOwnershipScopeBaselineRestore(repoState):
        return ROOT_DIRECT

    unit = findSubstantialBoundedUnit(mainTask)
    if unit is absent:
        return ROOT_DIRECT

    gate = [
        unit preserves the user objective and upstream workflow,
        repository is safe for delegation,
        exact mutually-exclusive read/write paths are declared,
        preflight baseline exists for every writable path,
        fresh-context suitability is confirmed for the tuple,
        deterministic verification and expected result are named,
        every owned path can be restored or discarded,
        packet contains all material facts and prohibitions,
        expectedBenefit > prep + supervisionReview + likelyRecovery,
    ]
    if any gate item is false or uncertain:
        return ROOT_DIRECT

    if unit.action == READ_LOG_WINDOW or unit.action == WRITE_UNIT_TESTS:
        return LUNA_XHIGH_BACKGROUND
    return TERRA_HIGH_BACKGROUND
~~~

READ_LOG_WINDOW 只能读取声明的日志路径和明确的时间/行号窗口，返回时间线、指标或事实以及证据位置，不做写入，也不做更宽的判断。WRITE_UNIT_TESTS 只能写声明的测试路径和明确的测试名，不改生产代码，并报告声明的新旧测试均通过。除此之外，所有通过门槛的有界执行单元都交给 Terra。

### 决定表

| 决定 | 固定原生 tuple | 适用条件 | 明确不做什么 |
| --- | --- | --- | --- |
| ROOT_DIRECT | Root 当前模型 | 任一门槛失败、缺资料、估算不确定，或触发 stand-down | 不创建子 Agent |
| LUNA_XHIGH_BACKGROUND | gpt-5.6-luna / xhigh / fork_turns: none | 仅 READ_LOG_WINDOW 或 WRITE_UNIT_TESTS 且全部 9 项门槛通过 | 不扩写判断，不创建后代，不改未声明路径 |
| TERRA_HIGH_BACKGROUND | gpt-5.6-terra / high / fork_turns: none | 其他通过门槛的有界执行单元 | 不替换 tuple，不创建后代 |

同一时刻最多一个活动子 Agent。Child 不是 Worker delegator，不能创建后代、改变 tuple 或扩大所有权。

<br>

## all-required gate：九个条件缺一不可

背景路由只有在以下九项全部为真时才成立：

1. 单元必须 substantial 且 bounded，能够拆出而不改变用户目标或上游流程；
2. 仓库安全，没有活动 merge/rebase conflict，也没有未解决的所有权或范围歧义；
3. 声明精确且互斥的 Worker 可写路径，或者为只读单元声明精确路径和时间/行号窗口；
4. 每一条可写路径都有捕获的 preflight baseline；
5. 已确认选定 tuple 适合 fresh context；
6. 已写出确定性的验证命令和预期结果；
7. 每条所有权路径都可以安全 restore 或 discard；
8. Task Packet 包含全部事实、约束和禁止事项，可以脱离 Root 历史独立执行；
9. break-even 为正，而且预期收益严格大于准备、监督/审查和可能恢复的总和。

第 3 项强调“精确”：一个目录大概归谁，不是可验证的所有权；“处理完再看看”也不是 deterministic verification。第 4、7 项把失败恢复提前到委派之前，避免子 Agent 结束后才发现没有已知状态可回退。

<br>

## Luna 和 Terra 的协作边界

Luna 不是一个“更聪明的通用执行者”，它只有两个 allowlist 动作。日志读取必须返回事实和准确证据位置，不能顺手提出更广泛的设计结论；测试写入必须限定测试文件和测试名，生产代码改动直接越界。

其余合格工作由 Terra 处理：例如在已知范围内做一次小型修复、更新一个声明的文档片段，或执行能被命令确定性验收的 bounded unit。Terra 的 repair 也有限制：初始任务加上最多两次 focused repair follow-up；每次 follow-up 仍使用同一个 child、同一 model、effort、执行面和 fresh-context 边界。不能借 repair 换 tuple、换表面、换上下文或换成另一个 child。

<br>

## 生命周期与失败恢复

生命周期只有一条所有权不变量：每个可写路径要么仍属于 Root，要么在 Child 活动期间被独占，要么已被 Root 明确 adopt，要么已恢复到捕获的 baseline。Child 结束时不能留下 unresolved writable path。

Root 先读 Policy，确认门槛，确认原生工具确实支持固定 tuple 和 fresh context，再创建一个完整 Packet。Child 得到独占路径，Root 在它活动期间不能编辑这些路径。Child 返回后，Root 检查响应和每个声明的工作区输出，与 baseline 比较，执行确定性验证，只 adopt 已验证的结果；其他输出必须恢复，然后才能关闭 Child。

Luna 失败或结果不可验证时，没有第二次 Luna。Root 必须记录相对 preflight baseline 的完整 diff，独立验证每个候选变化，只采纳独立验证通过的部分，恢复所有未采纳路径，再记录 resolved post-Luna baseline。若仍有一个新的、边界明确的残余单元，可以**恰好**创建一次 fresh Terra；它的 Packet 必须列出每个 Luna 变化的 adopt/restore 证据、所有残余和“当前不存在未验证 Luna 变化”的明确声明。否则 Root 直接接管。

Terra 初始执行和最多两次 focused repair 后，或任意明确失败后，Root 解决所有路径并接管。Child 的输出是证据，不是自动生效的状态；无论 Luna 还是 Terra，最后的整合、最终检查和交付都由 Root 完成。

<br>

## Task Packet 是可执行的接口

下面是一个说明结构的 YAML。它不是第二份 Policy，也不会选择模型；它只在 Policy 门槛通过后，由 Root 填入一次具体事实。

~~~
route:
  decision: TERRA_HIGH_BACKGROUND
  tuple: {model: gpt-5.6-terra, reasoning_effort: high, fork_turns: none}
objective: "修复一个可独立验收的文档构建问题"
ownership:
  read: ["docs/build-guide.md", "test/build-guide.test.ts"]
  write: ["docs/build-guide.md"]
  exact_owner: "Terra only while active"
  baseline: "sha256:... captured before create"
  do_not_touch: ["src/", "package.json", "external systems"]
facts:
  - "失败命令和相关行号"
  - "用户授权与上游 Skill 约束"
constraints:
  - "不改生产代码，不创建后代，不扩大路径"
break_even:
  unit: minutes
  expected_benefit: 30
  packet_preparation: 6
  supervision_review: 5
  likely_recovery: 4
  total_cost: 15
  strict_comparison: "30 > 6 + 5 + 4"
verification:
  command: "npm test -- --test-name-pattern build-guide"
  expected: "旧测试和新增测试均通过"
restore:
  procedure: "restore docs/build-guide.md to captured baseline"
evidence: "return diff, test output, and exact changed paths"
no_delegation: "do not create a child Worker or broaden judgment"
luna: # 仅 Luna route 填写
  action: null # READ_LOG_WINDOW or WRITE_UNIT_TESTS
  declared_log_path: null
  declared_log_window: null
  declared_test_paths: []
  explicit_test_names: []
  no_broader_judgment: true
terra_after_luna: # 仅 Luna 失败后的 fresh Terra 填写
  complete_pre_luna_diff: null
  adopted_candidates: []
  restored_paths: []
  resolved_post_luna_baseline: null
  remaining_bounded_remnants: []
  no_unverified_luna_changes: null
~~~

如果同一份 Packet 是 Luna 失败后的 Terra 尝试，还要填入完整 Luna diff、每个候选的独立采纳证据、每条恢复路径及其证据、resolved post-Luna baseline、所有剩余 bounded remnant，并写明没有未验证的 Luna 变化。字段缺失就不再委派。

<br>

## 为什么不做 executable router

静态协议足以表达“谁有权决定、什么条件才能委派、何时必须恢复”。再添加一个可执行控制平面，会产生第二个权力来源：它要维护分类器、注册表、路由模型、状态和 telemetry，还会引入与原生子 Agent API 的同步问题。这个版本刻意不承担这些东西。

运行时只需要一条简短的 commentary receipt，例如：

~~~
Auto Router: TERRA_HIGH_BACKGROUND; reason: bounded doc repair; verify: npm test
~~~

这条 receipt 是当前任务的说明，不写入文件，不发送给 Dashboard，也不作为下一次 Route Decision 的输入。Dashboard/history/credits/labels 只是观察信息，不能变成隐式控制面。

<br>

## 验证边界：证明形状，不假装证明激活

源仓库的 npm test 检查 Policy 是唯一深 Module、三种 tuple、九项 gate、Task Packet 字段、生命周期所有权以及禁止的可执行路由文件。它能证明静态文本仍然满足这些不变量；它不能证明某个平台真的会自动创建正确的原生子 Agent。

写作前重新运行源仓库的 npm test，结果为 24/24；构建博客时另行执行已有的 Jekyll 检查，不把静态测试结果写成运行时收益。自动路由是否激活、固定 tuple 是否被平台接受、fallback 是否在真实环境执行，都需要受控试运行提供证据。

<br>

## 当前限制与部署清单

v2.1 当前仍有三项明确限制：

- 现有全局 codex-orchestration policy 与这份协议存在 authority 冲突，v2.1 pilot 不能在两份规则同时生效时宣称完成；
- repo Skill 没有默认全局安装或暴露给每个运行环境；
- 原生 tuple、自动考虑和失败恢复尚未由目标运行时证明。

因此部署前应按顺序完成：

1. 选定唯一的 routing authority，并消除全局 policy 冲突；
2. 安装并暴露 repo Skill，确认所需原生工具支持 model、reasoning effort 和 fresh context；
3. 按需重启使 Skill 可见；
4. 用受控 pilot 分别覆盖 Root Direct、Luna 日志读取、Luna 测试写入、Terra 初始执行、Terra repair 和 Luna 失败后的恢复；
5. 收集每次 packet、baseline、验证输出、adopt/restore 决策和最终路径状态。

在这些证据出现之前，不声称节省了多少 token、时间或费用，也不把 Dashboard 上的 credits 当成测量结果。这里先建立一个能被证伪的合同，数字留给真实运行。

<br>

## 结语

Codex Auto Router v2.1 的重点不是让更多任务离开 Root，而是让每一次离开都具备边界、基线和回收路径。自动考虑保持入口简单；all-required gate 限制委派；Luna allowlist 保持窄责任；Terra repair 有上限；Root 独立验证并拥有最终交付。

完整策略和测试目前仍在 Codex Auto Router 项目中维护，这篇文章先公开架构与验证边界。源码仓库建立公开 remote 后再补充链接；其他项目可以从 [miniLV 的 GitHub](https://github.com/miniLV) 查看。如果未来的运行时证据证明某条边界不够，再修改唯一的深 Module，并让静态测试和受控 pilot 一起说明变化。
