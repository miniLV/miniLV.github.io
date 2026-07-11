---
layout:     post
title:      "给 AI Agent 一个本地自我进化的知识库"
subtitle:   "把每天的对话变成下一次还能用的工程经验"
date:       2026-07-11 12:00:00
author:     "miniLV"
header-img: "img/post-bg-2015.jpg"
summary:    "LLM Wiki Agent Memory 把本机的 Codex、Claude Code 会话整理成可查询、可审查的 Markdown Wiki，让 Agent 从过去的工作中积累经验。"
tags:
    - AI
    - Agent
    - Obsidian
    - Developer Tools
---

Codex 和 Claude Code 用得越多，一个问题就越明显：真正被浪费的不只是 token，还有每次对话结束后丢掉的信息。

一次完整的 Agent 对话里有很多有价值的信息：功能为什么需要修改，Agent 查过哪些文件，某个 bug 最后定位到哪里，哪些方案试过但不成立，以及技术决定是如何形成的。

这些不是闲聊，而是一段真实的工程过程。问题是，对话结束后，它们通常就躺在 session 记录里。下一次换个 task，Agent 又从一个几乎空白的上下文开始。同一个坑再查一遍，同一个背景再解释一次。

`AGENTS.md` 也不适合拿来装这些东西。它应该放稳定的项目约定，不应该越写越像工作流水账。

于是有了 [LLM Wiki Agent Memory](https://github.com/miniLV/llm-wiki-agent-memory)：把一次性的对话整理成留在本地、随着使用不断生长的工程知识库。

<br>

## 怎么把对话变成能用的知识

第一步不是让 Agent “记住一切”，而是把每天真正发生过的事情留下来。

系统会读取本机的 Codex 和 Claude Code session，把当天的对话整理成一页 Daily。它会记录用户当时要解决什么、做过哪些调查、最后改了什么，并保留指向原始会话的证据链接。

但 Daily 只是一份当天的工作备份，不等于长期知识。真实对话里有试错、重复命令和中途被推翻的猜测。第一次总结出来的“经验”，也可能只是碰巧在这一次成立。

所以还有第二步：定期 Review。

Review 会重新看一段时间内的 Daily，判断哪些内容有足够证据、是否在不同任务里重复出现、下次能不能直接指导行动。通过复查的内容才会进入 Concept，成为以后可以查询和复用的经验。没有通过的内容不会消失，仍然留在 Daily 里作为历史记录。

整个过程可以简单理解成：

```text
Agent 对话
  -> Daily：保留当天事实和原始证据
  -> Review：过滤猜测、重复和低价值总结
  -> Concept：沉淀经过复查的工程经验
  -> 下次对话：按问题把相关经验交给 Agent
```

这样形成的不是一个只进不出的聊天仓库。Agent 每完成一些工作，知识库就多一点事实；经过 Review，又多一点可信经验；下一次遇到相似问题时，这些经验再回到新的对话里。

这里的“自我进化”不是让模型自己修改规则，而是从真实完成的工作里积累证据，经过复查后再谨慎复用。

![LLM Wiki Agent Memory 架构图](/img/in-post/llm-wiki-agent-memory/agent-memory-arch-sketch.png)

<br>

## 为什么是本地 Markdown

这类工具很容易一路做成向量数据库、embedding、RAG 服务，最后为了记住几个工程决定，先养起一套基础设施。

对于这个项目，这套基础设施没有必要。会话里经常有私有仓库路径、需求细节和调试信息，留在本机更合适。Markdown 也足够透明：可以用 Obsidian 查看，可以用 Git 管理，也可以直接检查 Agent 写入的内容。即使停止使用，文件仍然可以直接读取，不需要额外导出。

整个过程像一个小飞轮。每天先留下事实，隔一段时间再复查；真正有用的经验进入 Concept，之后由只读的 loader 提供给其他项目查询。

![本地自我进化的 Agent 知识库](/img/in-post/llm-wiki-agent-memory/agent-memory-loop-flywheel.png)

Daily 和“可复用经验”被明确隔开。第一次总结只当候选，不直接生效。二次 review 会检查证据是否充分、内容是否重复出现、能否指导下一次行动。未通过的内容继续留在 Daily 里作为备份。

这一步看起来多余，实际很重要。Agent 最麻烦的不是忘记，而是很有把握地记错。

<br>

## 它能带来什么

最直接的变化，是不用每次都重新做背景调查。

在任意项目里都可以查询“这个功能以前遇到过什么问题”，也可以按日期、ticket、repo 或具体关键词找回当时的处理过程。答案仍然能追溯到原始 session，不是凭空生成的一条“最佳实践”。

另一个收益是，工程过程有了比聊天记录更容易阅读的落点。当天发生的事实和经过复查的经验有清晰边界。即使 Agent 给出的总结不够准确，也可以直接修改 Markdown，不需要操作一个不可见的记忆黑盒。

本地配置页把采集来源、Daily 和 Weekly 任务放在一起。平时不需要一直盯着它，配置好之后让 Codex App Automations 定期跑就行。

![LLM Wiki Agent Memory 本地配置界面](/img/in-post/llm-wiki-agent-memory/local-config-ui.png)

<br>

## 现在适合谁

如果你只偶尔用一次 AI 编程工具，这套东西大概没什么必要。聊天历史已经够用。

如果你同时维护多个项目，习惯让 Agent 参与排查、重构和技术决策，而且已经开始反复解释“上次为什么这么改”，那它可能会省下一些时间。尤其是那些隔了两三周又出现的问题，有一份能追溯证据的本地记录，比依赖自己记忆靠谱得多。

项目仍在继续调整。现阶段关注的不是尽可能多地记录，而是避免把未经复查的内容当成经验。宁可少保留一些，也不要让一次临时总结变成长期知识。

安装和具体用法就不在这里展开了，README 写得更完整：

[GitHub：miniLV/llm-wiki-agent-memory](https://github.com/miniLV/llm-wiki-agent-memory)

*如果你也被 Agent 反复失忆折腾过，可以试试看。*
