# 兩款生活小工具 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** 新增 split.html、lunch.html 與首頁 Tools 區塊。
**Architecture:** 兩個自包含 HTML（內嵌 CSS/JS），共用 tools.css 做同家族外觀；首頁加一個 section。
**Tech Stack:** 原生 HTML/CSS/JS、Overpass API、Playwright（驗證）。
**Spec:** docs/superpowers/specs/2026-11-25-life-tools-design.md

## Global Constraints
- GA4 `G-ZSVL2PNT60`；og:image 絕對網址 `https://austenjuan2222.github.io/my-website/…`
- 頂部「← 首頁」膠囊按鈕，手機也顯示文字
- 375px 寬無水平捲動

## Review Focus
- 分帳：金額 0、空白、人數 1、除不盡（進位後總和 ≥ 帳單）
- 進階分帳：有人沒點東西（個人金額 0）
- 午餐：拒絕定位 → 顯示說明並切到自訂清單
- 午餐：Overpass 逾時/429 → 換備援端點，再失敗則提示
- 午餐：店家沒名字 → 排除

---

### Task 1: tools.css + split.html
- [ ] 寫 `calcSplit({total, people, service, roundUp, items[]})` → `{perPerson[], grand}`，Playwright 測：1000/3 進位 → 334×3；服務費 10% → 1100
- [ ] UI、複製結果（navigator.clipboard，失敗時選取文字）
- [ ] head：title/description/og/favicon/GA4；commit

### Task 2: lunch.html
- [ ] `fetchPlaces(lat, lon, radius)` Overpass，主端點 overpass-api.de，備援 overpass.kumi.systems，12 秒逾時
- [ ] `distance()` haversine、篩選、抽選動畫（尊重 prefers-reduced-motion）、Google 地圖連結 `https://www.google.com/maps/dir/?api=1&destination=lat,lon`
- [ ] 自訂清單（localStorage try/catch）；commit

### Task 3: 首頁 Tools 區塊、og 圖、favicon、sitemap
- [ ] index.html 新增 `#tools` section 與導覽連結；sitemap 加兩頁
- [ ] og-split.jpg、og-lunch.jpg（Playwright 截 1200×630）；favicon-split.svg、favicon-lunch.svg
- [ ] Playwright 桌機/手機截圖驗證；commit
