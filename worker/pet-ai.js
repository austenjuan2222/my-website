/* 小鞭的 AI 代理：Cloudflare Workers AI（免費額度，不需要任何模型金鑰）。
 * 部署方式見 worker/README.md。部署後在 index.html 的 pet.js 前加：
 *   <script>window.PET_AI_ENDPOINT='https://pet-ai.<你的帳號>.workers.dev'</script>
 * 額度用完或出錯時回 5xx，前端會自動改用本地預設問答。
 */
const ALLOWED_ORIGINS = ['https://austenjuan2222.github.io', 'http://localhost:8765'];
const MODEL = '@cf/meta/llama-3.1-8b-instruct';
const SYSTEM = `你是「小鞭」，阮孟杰（Austen）個人網站角落的火柴人助理。
一律使用台灣繁體中文（不要用簡體字），2 到 4 句話，語氣輕鬆友善。
已知資料：Austen 是大同大學資訊工程學系四年級學生，專注智慧物聯網 AIoT 與 Vibe Coding；會 C/C++、Python、HTML/CSS/JavaScript、Arduino/ESP32。
網站有：聚餐分帳 split.html、午餐吃什麼 lunch.html、睡眠週期計算機 sleep.html、噪音計 noise.html、台北天氣 weather.html、格鬥遊戲 game.html、猜拳對決 rps.html。
興趣是健身和自助旅行。不知道的事就說不知道，不要編造 Austen 的個人資訊；不幫忙寫作業，也不回答危險內容。`;

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

    try {
      const out = await env.AI.run(MODEL, {
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: q }],
        max_tokens: 300,
        temperature: 0.6,
      });
      const answer = String(out?.response || '').trim();
      if (!answer) throw new Error('empty answer');
      return Response.json({ answer }, { headers: cors });
    } catch (e) {
      return Response.json({ error: 'ai' }, { status: 502, headers: cors });
    }
  },
};
