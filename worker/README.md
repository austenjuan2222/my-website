# 小鞭 AI 代理（Cloudflare Workers AI）

已部署：https://pet-ai.austenjuan4.workers.dev （2026-11-25）

模型會被 Cloudflare 汰換，`MODELS` 依序嘗試，全部失敗時網站自動改用預設問答。要換模型就改這個清單再重新部署。

免費：Workers AI 每天有免費額度，不用綁卡，也不用申請模型金鑰。

## 方法 A：網頁後台（不用裝任何東西）
1. 到 https://dash.cloudflare.com 註冊／登入。
2. 左側 **Workers & Pages** → **Create** → **Create Worker**，名稱填 `pet-ai` → **Deploy**。
3. 按 **Edit code**，把 `pet-ai.js` 全部內容貼上，覆蓋原本的程式 → **Deploy**。
4. 回到這個 Worker → **Settings** → **Bindings** → **Add** → **Workers AI**，變數名稱填 `AI` → 儲存。
5. 複製網址（像 `https://pet-ai.xxx.workers.dev`）給 Claude，由 Claude 接到網站上。

## 方法 B：指令列
```
cd worker
npx wrangler login
npx wrangler deploy
```

## 安全
- 只接受 `https://austenjuan2222.github.io` 來的請求（`ALLOWED_ORIGINS`）。
- 沒有任何金鑰在前端；額度用完時網站自動改用預設問答。
