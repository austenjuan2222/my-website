# 第 12 週：兩款生活小工具（設計）

Austen 已於 2026-11-25 在專案對話中核准。

## 目的
課堂作業：自行發想 2 款「解決生活問題」的獨立網頁工具，放進首頁 Tools 區塊。目標是「被使用、被分享、被回訪」。

## 工具
1. **聚餐分帳 `split.html`**：總金額＋人數，可加服務費 10%、進位到整數；進階模式逐人輸入自己點的金額，再均攤共同費用；一鍵複製結果貼到 LINE。
2. **午餐吃什麼 `lunch.html`**：瀏覽器定位 → OpenStreetMap Overpass API 抓附近餐飲（restaurant / fast_food / cafe / food_court），可選距離 300/500/1000m、類型篩選，抽一家並附距離與 Google 地圖導航連結。定位被拒或沒資料時，改用自訂清單抽籤（存 localStorage）。

## 共同規格（檢核表）
工具能正常運作、首頁 Tools 區塊有連結、「← 首頁」連結、SVG favicon、GA4 `G-ZSVL2PNT60`、title、meta description、og 分享卡（1200×630 圖）、手機版可用。

## 方法取捨
- 午餐資料：OSM Overpass（選用，免金鑰、支援 CORS）；Google Places 需帳單帳號（不採用）；只開 Google 地圖搜尋連結（無法「幫你選」，不採用）。
- 純 HTML/CSS/JS，各頁獨立、無建置流程，符合 repo 現況（GitHub Pages）。

## 非目標
不做帳號、後端、Google 店家評分。風格與首頁同家族但不照抄版面。
