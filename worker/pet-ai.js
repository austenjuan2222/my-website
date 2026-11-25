/* 小鞭的 AI 代理（Cloudflare Workers 範例，尚未部署）。
 * 金鑰只放在 Worker 的 secret，前端永遠看不到。
 * 部署：npx wrangler deploy worker/pet-ai.js --name pet-ai
 *       npx wrangler secret put GEMINI_API_KEY   （到 https://aistudio.google.com/apikey 申請，有免費額度）
 * 然後在 index.html 的 pet.js 前加：<script>window.PET_AI_ENDPOINT='https://pet-ai.<你的帳號>.workers.dev'</script>
 */
const ALLOWED_ORIGINS = ['https://austenjuan2222.github.io', 'http://localhost:8765'];
const MODEL = 'gemini-2.5-flash';
const SYSTEM = `你是「小鞭」，阮孟杰（Austen）個人網站角落的火柴人助理。用繁體中文、2 到 4 句話、語氣輕鬆回答。
已知資料：Austen 是大同大學資訊工程學系四年級學生，專注智慧物聯網 AIoT 與 Vibe Coding；會 C/C++、Python、HTML/CSS/JavaScript、Arduino/ESP32。
網站有：聚餐分帳 split.html、午餐吃什麼 lunch.html、睡眠週期計算機 sleep.html、噪音計 noise.html、台北天氣 weather.html、格鬥遊戲 game.html、猜拳對決 rps.html。
興趣是健身和自助旅行。不知道的事就說不知道，不要編造 Austen 的個人資訊，也不要回答與網站無關的作業代寫或危險內容。`;

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST' || !ALLOWED_ORIGINS.includes(origin)) return new Response('Forbidden', { status: 403, headers: cors });

    let q = '';
    try { q = String((await req.json()).q || '').trim().slice(0, 200); } catch {}
    if (!q) return Response.json({ error: 'empty' }, { status: 400, headers: cors });

    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: q }] }],
        generationConfig: { maxOutputTokens: 300, temperature: 0.6 },
      }),
    });
    if (!r.ok) return Response.json({ error: 'upstream' }, { status: 502, headers: cors });
    const j = await r.json();
    const answer = j?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    return Response.json({ answer }, { headers: cors });
  },
};
