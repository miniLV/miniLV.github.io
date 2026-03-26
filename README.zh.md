# miniLV Jekyll Notes

这是一个以阅读体验为优先、保留 GitHub Pages 原生发布方式的 Jekyll 博客主题。

## 你会得到什么

- 继续在 `_posts/` 里写 Markdown
- 继续用 GitHub Pages 自动发布
- 样式改为 Jekyll 原生 SCSS，不再依赖 Grunt / LESS / jQuery / Bootstrap
- 首页、文章页、标签页、404 页面统一为新的主题语言
- 支持可选的 `summary` 和 `featured` front matter

## 本地预览

1. 安装 Ruby 和 Bundler
2. 安装依赖：

   ```bash
   bundle install
   ```

3. 启动本地服务：

   ```bash
   bundle exec jekyll serve
   ```

4. 打开 `http://127.0.0.1:4000`

## 新建文章

在 `_posts/` 下创建一个 Markdown 文件，例如：

```md
---
layout: post
title: "文章标题"
subtitle: "可选副标题"
date: 2026-03-26 12:00:00
author: "你的名字"
tags:
  - Jekyll
  - Notes
summary: "可选，自定义卡片摘要。"
featured: true
header-img: "img/post-bg-2015.jpg"
---

正文内容写在这里。
```

说明：

- `summary` 可选，不填时会自动回退到 `subtitle` 或正文摘要
- `featured` 可选，首页第 1 页会优先选中第一个 `featured: true` 的文章作为主打卡片
- `header-img` 可选，不填也能正常渲染

## 站点配置

主要配置都集中在 `_config.yml`：

- `hero_title`
- `hero_description`
- `hero_primary_cta`
- `hero_secondary_cta`
- `nav_items`
- `social_links`
- `footer_note`

## 发布方式

这个仓库仍然走 GitHub Pages 默认链路：

1. 推送到你的 `<username>.github.io` 仓库
2. 在 GitHub Pages 设置里选择默认分支发布
3. GitHub Pages 会自动用 Jekyll 构建并上线

不需要额外写 GitHub Actions。

## 字体（可选）

主题开箱即用，不装字体也能正常显示。如果想更接近目标风格，可以在本地安装：

- `DM Sans`
- `JetBrains Mono`

主题的字体栈已经会在可用时自动使用它们。

## 仓库说明

- 旧的 Bootstrap / jQuery / LESS / Grunt 链路已经移除
