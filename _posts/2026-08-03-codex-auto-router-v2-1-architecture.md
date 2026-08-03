---
layout: post
title: "Codex Auto Router"
subtitle: "不用手动切模型：按任务边界自动路由到 Sol、Luna 或 Terra"
date: 2026-08-03 00:00:00 +0800
author: "miniLV"
header-img: "img/headers/2026-08-03-codex-auto-router-v2-1.png"
summary: "一次配置，按任务复杂度、风险和可验证性自动选择合适的执行模型。"
tags:
    - Codex
    - AI Agent
    - 模型路由
    - 多智能体
    - 软件架构
---

用 Sol 做每一件事，通常最省心，也最贵。把日志扫描、单测补齐这类低风险工作交给 Luna，成本会下来；但边界没想清楚就把修复任务扔过去，省下来的额度很快会在返工里吐回去。至于什么时候该切到 Terra，很多时候又只能靠人盯着任务临场判断。

这就是手动切模型最烦的地方：每接一个任务，都要在成本、质量和上下文之间重新做一遍选择。任务一多，切换本身就成了新的工作。

Codex Auto Router 的核心价值，是把这件事变成一次配置后的自动判断。它不靠一个黑盒“复杂度分数”硬猜，而是同时看任务是否能安全拆分、范围是否明确、结果能不能机械验收、失败后有没有恢复路径：可被严格收窄的日志读取和测试写入交给 Luna；其余通过检查的有界执行单元交给 Terra；只要有不确定，就让 Root 留在 Sol 直接完成。

一句话：**把 Sol 留给必须由它承担的高判断工作，把可验证的执行单元自动交给合适的 Worker，不再为每个任务手动切档。**

项目源码（当前为私有仓库）：[miniLV/codex-auto-router](https://github.com/miniLV/codex-auto-router)。这篇不重复贴文档，只聊这套约束为什么值得写得这么死。

[![Root、Luna、Terra 与验证交付的自动路由总流程](/img/in-post/codex-auto-router/routing-overview.jpg)](/img/in-post/codex-auto-router/routing-overview.jpg)
*总流程：Root 决定，单一 Child 执行，Root 验证并交付。*

## 真正的成本，不在模型调用那一下

| 朴素失败 | 静态协议 |
| --- | --- |
| 只看模型强弱 | 同时计算准备、监督、审查和恢复 |
| 把 Child 当黑盒 | 先声明路径、基线与确定性验收 |
| 失败后继续堆委派 | 回到已知基线，再由 Root 接管 |

一次委派不是一次函数调用。Root 要整理背景、划清写入范围、给出验收命令；Child 回来后，还得看 diff、跑验证、处理没被采纳的改动。把这些都算上，委派只有在下面这个式子严格成立时才值得：

`expected benefit > packet prep + supervision/review + recovery`

数字缺失、单位没法比较、恢复代价说不清，都不叫“差不多能赚”，而是直接 `ROOT_DIRECT`。小改动、需要连续判断的工作、外部动作、验收只能靠感觉的工作，也都别硬拆。

## 路由只有三条，别搞成模型抽奖

- `ROOT_DIRECT`：Root 当前模型。任一门槛失败、资料缺失、估算不确定，或 ownership、范围、基线、恢复状态有歧义。
- `LUNA_XHIGH_BACKGROUND`：固定 `gpt-5.6-luna / xhigh / fork_turns: none`；仅用于 `READ_LOG_WINDOW` 或 `WRITE_UNIT_TESTS`。
- `TERRA_HIGH_BACKGROUND`：固定 `gpt-5.6-terra / high / fork_turns: none`；用于其他通过全部门槛的 bounded 单元。

同一时刻最多一个 active child。Child 不能再创建 descendants，不能换 tuple，更不能趁机扩大 ownership。它在干活时，Root 也不碰那几条独占路径。Dashboard、history、credits、labels 都只是旁观数据，不能偷偷变成路由依据。

## 九道检查，任何一道模糊就刹车

1. 单元 substantial 且 bounded，不改变用户目标或上游流程。
2. 仓库安全，没有 merge/rebase conflict，也没有 ownership 或范围歧义。
3. Worker 的读写路径精确、互斥；只读日志还要有明确时间/行号窗口。
4. 每条可写路径都有委派前捕获的 preflight baseline。
5. 已确认固定 tuple 适合 fresh context。
6. 已写出确定性的验证命令与预期结果。
7. 每条 ownership 路径都能安全 restore 或 discard。
8. Task Packet 含全部事实、约束和禁止事项，脱离 Root 历史也可执行。
9. 预期收益严格大于 packet preparation、supervision/review 与 likely recovery 的总和。

这不是为了把流程写复杂，而是把“出了问题谁来收场”提前写清楚。把整套规则压成伪代码，其实只有几行：

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

## Luna：只做两件小事

[![Luna allowlist 的日志读取与测试写入边界](/img/in-post/codex-auto-router/luna-allowlist.jpg)](/img/in-post/codex-auto-router/luna-allowlist.jpg)
*Luna 只读指定日志窗口，或只写指定测试。*

Luna 不是“便宜一点的通用 Worker”。它只处理两个被收窄的动作：`READ_LOG_WINDOW` 和 `WRITE_UNIT_TESTS`。前者只能读取写明的日志窗口，回来时带上事实和证据位置；后者只能改指定测试，生产代码一行不动。两种任务都不能继续派生子任务。

这样做的好处是，失败时不用临场发挥：

1. 相对 preflight baseline 解析完整 diff。
2. 独立验证候选变化，只 adopt 有证据的部分。
3. restore 其余路径，清除所有未采纳变化。
4. 记录 resolved post-Luna baseline；只有仍有新的 bounded 残余，才至多创建一次 fresh `TERRA_HIGH_BACKGROUND`，并明确没有未验证的 Luna 变化，否则 Root 直接接管。

## Root 是控制面，Worker 只是执行面

[![Root 控制面与 Worker 执行面的分层](/img/in-post/codex-auto-router/execution-layering.jpg)](/img/in-post/codex-auto-router/execution-layering.jpg)
*分层图：Root 保持全链路职责，Worker 只执行声明单元。*

下图是这套设计最重要的一条边界：Root 负责理解需求、做计划、决定委派、确认授权、执行外部动作、整合结果和最终交付；Worker 只在约定好的路径里完成一个单元。

所以 Child 的输出不是“已经生效的改动”，而是一份候选结果。Root 要对照 baseline 看 diff、跑验收，只采纳已经验证过的部分；其余恢复。这个动作有点笨，但它避免了“子 Agent 看起来做完了，仓库却多了一堆没人说得清的变化”。

## Terra：可以修，但不能无限重试

Terra 处理其余通过检查的 bounded 单元。它先在 fresh context 执行初始 Packet，Root 随后检查证据、diff、测试和路径所有权。

如果只是一个明确的小缺口，可以让**同一个 Worker、同一套 tuple**再做最多两次 focused repair。方向跑偏、越界、结果无法验证，或者两次修复仍没过，就到此为止：Root 先把路径解决干净，再自己接管。没有“再换个 Agent 试试”的无限重试。

## 最后一个容易被忽略的事实：静态通过，不等于运行时正确

项目当前的静态测试为 24/24；这证明策略文本、固定 tuple、九个门槛和生命周期约束仍然一致。

但它不证明运行时一定会自动创建正确的 Child，也不证明真实平台上的授权、恢复和 fallback 都跑对了。那部分必须用受控试运行拿证据，不能靠一张漂亮架构图给自己加分。

我更看重的也正是这点：自动路由的价值，不是让更多任务离开 Root，而是让每一次离开都有边界、有基线，也有回来的路。

完整实现、策略文档和测试都在 [GitHub 项目（当前私有）](https://github.com/miniLV/codex-auto-router)。
