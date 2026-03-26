# miniLV Jekyll Notes

An editorial Jekyll blog theme rebuilt for a calmer, Anthropic-inspired reading experience.

## What You Get

- Markdown-first authoring in `_posts/`
- Native GitHub Pages deployment
- Jekyll Sass pipeline, no Grunt or front-end bundler
- Responsive home page, post page, tags page, and 404 page
- Optional `featured` and `summary` front matter for richer cards

## Quick Start

1. Install Ruby and Bundler.
2. Install dependencies:

   ```bash
   bundle install
   ```

3. Run the site locally:

   ```bash
   bundle exec jekyll serve
   ```

4. Open `http://127.0.0.1:4000`.

## Write a Post

Create a new Markdown file in `_posts/`:

```md
---
layout: post
title: "Your title"
subtitle: "Optional subtitle"
date: 2026-03-26 12:00:00
author: "Your name"
tags:
  - Jekyll
  - Notes
summary: "Optional custom summary for cards."
featured: true
header-img: "img/post-bg-2015.jpg"
---

Your content here.
```

Notes:

- `summary` is optional. If omitted, cards fall back to the subtitle or an excerpt.
- `featured` is optional. On page 1, the first `featured: true` post becomes the featured card. If none exist, the first paginated post is used.
- `header-img` is optional. Posts still render cleanly without it.

## Customize the Site

Most site-level content lives in `_config.yml`:

- `hero_title`
- `hero_description`
- `hero_primary_cta`
- `hero_secondary_cta`
- `nav_items`
- `social_links`
- `footer_note`

## Publish

This repository stays compatible with the normal GitHub Pages flow.

1. Push to your `<username>.github.io` repository.
2. In GitHub Pages settings, use the default branch as the publishing source.
3. GitHub Pages builds the site with Jekyll automatically.

No extra GitHub Actions workflow is required.

## Optional Fonts

The theme works out of the box with system fonts. If you want it to feel closer to the design target, install these locally:

- `DM Sans`
- `JetBrains Mono`

The font stack already references them when available.

## Repository Notes

- The old Bootstrap, jQuery, LESS, and Grunt toolchain has been removed.
