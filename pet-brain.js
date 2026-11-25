/* 小鞭的問答大腦：本地關鍵字比對，不需要任何 API 金鑰。 */
(function (root) {
  'use strict';
  var KB = [
    { id: 'pet', keys: ['你是誰', '你叫什麼', '你是什麼', '小鞭', '寵物', '鞭子', '火柴人'],
      text: '我是小鞭，住在 Austen 網站角落的火柴人。點我會甩鞭子，也可以問我關於 Austen 和這個網站的事。拖著鞭子尾巴甩甩看！' },
    { id: 'ai', keys: ['ai', '人工智慧', 'gpt', 'chatgpt', '機器人', '真的', '怎麼做的', '原理'],
      text: '我現在用的是 Austen 寫好的問答資料，用關鍵字找答案，所以不用金鑰、離線也能回。超出範圍的問題我可能答不出來。' },
    { id: 'austen', keys: ['阮孟杰', '孟杰', 'austen', 'meng-jie', '站長', '作者', '介紹', '他是誰', '主人', '本人', '關於'],
      text: 'Austen（阮孟杰）是大同大學資訊工程學系四年級學生（2022 年入學），專注智慧物聯網 AIoT，也在玩 Vibe Coding 和現代網頁開發。課餘喜歡健身和出國自助旅行。',
      links: [{ label: '看「關於我」', href: '#about' }] },
    { id: 'school', keys: ['學校', '大學', '大同', '科系', '資工', '幾年級', '年級', '學生'],
      text: 'Austen 讀大同大學資訊工程學系，現在四年級。' },
    { id: 'skills', keys: ['技能', '會什麼', '專長', '程式', '語言', 'python', 'c++', 'javascript', 'arduino', 'esp32', '會寫'],
      text: '程式：C / C++、Python、HTML5 / CSS3 / JavaScript，也常用 AI 輔助開發。物聯網：感測器整合、Arduino / ESP32 微控制器、基本網路通訊協定。',
      links: [{ label: '看技能區', href: '#skills' }] },
    { id: 'projects', keys: ['專案', '專題', '作品', '研究', 'aiot', '物聯網', '經歷', '畢業'],
      text: '畢業專題做智慧物聯網（AIoT）應用：用物聯網裝置加數據分析，做自動感測和遠端控制。另外還有這個 Glassmorphism 個人網站、小遊戲，和 Firebase 即時連線的猜拳對決。',
      links: [{ label: '看專案區', href: '#projects' }] },
    { id: 'tools', keys: ['工具', '小工具', '功能', '有什麼', '有哪些', '能做什麼', '網站有'],
      text: '網站有四個生活小工具：💸 聚餐分帳、🍱 午餐吃什麼、🌙 睡眠週期計算機、🔊 噪音計。另外還有台北天氣和兩款小遊戲。',
      links: [{ label: '分帳', href: 'split.html' }, { label: '午餐', href: 'lunch.html' }, { label: '睡眠', href: 'sleep.html' }, { label: '噪音', href: 'noise.html' }] },
    { id: 'split', keys: ['分帳', 'aa', '聚餐', '付錢', '服務費'],
      text: '聚餐分帳計算機：輸入金額和人數，自動加服務費、進位成整數；各點各的也能算，結果可以一鍵複製貼到 LINE。',
      links: [{ label: '開始分帳', href: 'split.html' }] },
    { id: 'lunch', keys: ['午餐', '吃什麼', '餐廳', '肚子餓', '晚餐', '吃飯'],
      text: '「午餐吃什麼？」會用定位找附近 300 公尺到 1 公里的餐廳，隨機幫你抽一家，附步行時間和 Google 地圖導航。',
      links: [{ label: '幫我選', href: 'lunch.html' }] },
    { id: 'sleep', keys: ['睡眠', '睡覺', '幾點睡', '起床', '熬夜', '鬧鐘'],
      text: '睡眠週期計算機用 90 分鐘一個週期，幫你算幾點睡、幾點起床最不累，還能加到行事曆提醒。',
      links: [{ label: '算算看', href: 'sleep.html' }] },
    { id: 'noise', keys: ['噪音', '分貝', '吵', '安靜', '麥克風', '讀書'],
      text: '噪音計用手機麥克風即時測音量，顯示大約分貝和「圖書館／教室／捷運」等級。不錄音、不上傳。',
      links: [{ label: '開始測量', href: 'noise.html' }] },
    { id: 'weather', keys: ['天氣', '下雨', '氣溫', '溫度', '台北'],
      text: '首頁有台北今日天氣，點進去可以看完整預報。',
      links: [{ label: '看天氣', href: 'weather.html' }] },
    { id: 'games', keys: ['遊戲', '玩', '格鬥', '猜拳', '對戰', '排行榜', '無聊'],
      text: '有兩款小遊戲：極限街頭對決（格鬥，有排行榜），和猜拳對決（兩支手機輸入同一個 4 位數房號就能即時連線）。',
      links: [{ label: '格鬥遊戲', href: 'game.html' }, { label: '猜拳對決', href: 'rps.html' }] },
    { id: 'contact', keys: ['聯絡', '聯繫', 'email', 'mail', '信箱', '合作', '找他', '寫信'],
      text: '想交流專題或合作，可以寄信給 Austen，網站最下方也有聯絡方式。',
      links: [{ label: '寄信', href: 'mailto:austenjuan2@gmail.com' }, { label: '到聯絡區', href: '#contact' }] },
    { id: 'hobby', keys: ['興趣', '嗜好', '健身', '運動', '旅遊', '旅行', '重訓', '平常'],
      text: 'Austen 課餘熱衷重量訓練和健康管理，也喜歡自助旅行、體驗不同文化。' },
    { id: 'news', keys: ['新聞', '消息', '法說會', '快訊'],
      text: '首頁「最新消息：法說會」每天早上 8 點自動更新，來源是 Google 快訊。',
      links: [{ label: '看最新消息', href: '#news' }] },
    { id: 'hello', keys: ['你好', '哈囉', '嗨', 'hi', 'hello', '安安', '早安', '晚安'],
      text: '嗨！我是小鞭 👋 想認識 Austen，還是想知道網站有哪些工具？' },
    { id: 'thanks', keys: ['謝謝', '感謝', '讚', '厲害', 'thx', 'thanks'],
      text: '不客氣！要我再甩一次鞭子嗎？啪！' }
  ];
  var FALLBACK = { id: 'fallback',
    text: '這題我還不會 😅 我比較懂這些：Austen 是誰、他會什麼、做過哪些專案、網站有哪些工具和遊戲、怎麼聯絡他。' };

  function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ''); }

  function answer(q) {
    var t = norm(q);
    if (!t) return FALLBACK;
    var best = null, bestScore = 0;
    for (var i = 0; i < KB.length; i++) {
      var score = 0;
      for (var k = 0; k < KB[i].keys.length; k++) {
        var key = norm(KB[i].keys[k]);
        if (t.indexOf(key) !== -1) score += key.length;
      }
      if (score > bestScore) { bestScore = score; best = KB[i]; }
    }
    return best || FALLBACK;
  }

  var api = { answer: answer, entries: KB, fallback: FALLBACK };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PetBrain = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
