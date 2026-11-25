/* 角落火柴人小寵物「小鞭」：Verlet 鞭子＋個人問答。需先載入 pet-brain.js。
 * 想接 AI：在本檔前加 <script>window.PET_AI_ENDPOINT='https://你的-worker網址'</script>，
 * 代理範例見 worker/pet-ai.js。沒設定或代理失敗時，自動用本地問答。 */
(function () {
  'use strict';
  if (window.__petLoaded) return; window.__petLoaded = true;

  var W = 220, H = 200;                       // 畫布邏輯座標
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
                set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  var muted = store.get('pet-muted') === '1';

  /* ---------- DOM ---------- */
  var root = document.createElement('div');
  root.className = 'pet';
  root.innerHTML =
    '<div class="pet-tip" aria-hidden="true">點我問問題，或拖鞭子甩甩看！</div>' +
    '<section class="pet-chat" id="pet-chat" role="dialog" aria-label="小鞭：Austen 的網站助理">' +
      '<div class="pet-head"><span aria-hidden="true">🤠</span><b>小鞭</b><small>Austen 的網站助理</small><span class="sp"></span>' +
        '<button class="pet-icon" type="button" data-act="mute"></button>' +
        '<button class="pet-icon" type="button" data-act="close" aria-label="關閉對話">✕</button></div>' +
      '<div class="pet-log" aria-live="polite"></div>' +
      '<div class="pet-chips"></div>' +
      '<form class="pet-form"><input type="text" maxlength="200" placeholder="問我 Austen 或網站的事…" aria-label="輸入問題" enterkeyhint="send">' +
        '<button type="submit">問</button></form>' +
    '</section>' +
    '<canvas class="pet-canvas" aria-hidden="true"></canvas>' +
    '<button class="pet-hit" type="button" aria-label="小鞭：點我甩鞭子並開啟問答" aria-expanded="false" aria-controls="pet-chat"></button>';
  document.body.appendChild(root);

  var canvas = root.querySelector('canvas'), ctx = canvas.getContext('2d');
  var hit = root.querySelector('.pet-hit');
  var log = root.querySelector('.pet-log'), chips = root.querySelector('.pet-chips');
  var form = root.querySelector('form'), input = form.querySelector('input');
  var muteBtn = root.querySelector('[data-act="mute"]');

  var grab = document.createElement('div');       // 鞭尾抓取點（跟著鞭尾跑）
  grab.style.cssText = 'position:absolute;left:0;top:0;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;' +
    'pointer-events:auto;touch-action:none;cursor:grab';
  grab.setAttribute('aria-hidden', 'true');
  root.appendChild(grab);

  function sizeCanvas() {
    var r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  }
  sizeCanvas(); window.addEventListener('resize', sizeCanvas);

  /* ---------- 音效（短促白噪音＝啪） ---------- */
  var audio = null;
  function crackSound(power) {
    if (muted) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      var n = Math.floor(audio.sampleRate * 0.07), buf = audio.createBuffer(1, n, audio.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
      var src = audio.createBufferSource(), hp = audio.createBiquadFilter(), g = audio.createGain();
      src.buffer = buf; hp.type = 'highpass'; hp.frequency.value = 1600;
      g.gain.value = Math.min(0.5, 0.18 + power * 0.02);
      src.connect(hp); hp.connect(g); g.connect(audio.destination); src.start();
    } catch (e) {}
  }
  function syncMute() {
    muteBtn.textContent = muted ? '🔇' : '🔊';
    muteBtn.setAttribute('aria-label', muted ? '開啟鞭子音效' : '關閉鞭子音效');
  }
  syncMute();

  /* ---------- 火柴人與鞭子 ---------- */
  var BODY_X = 172, SHOULDER = { x: 172, y: 118 }, IDLE_HAND = { x: 146, y: 132 };
  var N = 20, SEG = 6, pts = [];
  for (var i = 0; i < N; i++) pts.push({ x: IDLE_HAND.x - i * 2, y: IDLE_HAND.y + i * SEG * 0.95, px: IDLE_HAND.x - i * 2, py: IDLE_HAND.y + i * SEG * 0.95 });
  var hand = { x: IDLE_HAND.x, y: IDLE_HAND.y }, elbow = { x: 158, y: 130 };
  var crackT = -1, cooldown = 0, sparks = [], dragging = false, dragPt = null;
  var look = { x: 0, y: 0 }, pointer = null, blinkAt = 2.5, blinkUntil = 0, time = 0, interacted = false;

  function ease(t) { return 1 - Math.pow(1 - t, 3); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  var loud = false;
  function startCrack(silent) { if (!reduce && crackT < 0) { crackT = 0; loud = !silent; } }

  function handTarget(dt) {
    var bob = reduce ? 0 : Math.sin(time * 2) * 1.2;
    if (crackT < 0) return { x: IDLE_HAND.x + (reduce ? 0 : Math.sin(time * 1.3) * 2), y: IDLE_HAND.y + bob };
    crackT += dt;
    var wind = { x: 186, y: 76 }, snap = { x: 124, y: 124 }, t = crackT;
    if (t < 0.16) return { x: lerp(IDLE_HAND.x, wind.x, ease(t / 0.16)), y: lerp(IDLE_HAND.y, wind.y, ease(t / 0.16)) };
    if (t < 0.27) return { x: lerp(wind.x, snap.x, ease((t - 0.16) / 0.11)), y: lerp(wind.y, snap.y, ease((t - 0.16) / 0.11)) };
    if (t < 0.6) return { x: lerp(snap.x, IDLE_HAND.x, ease((t - 0.27) / 0.33)), y: lerp(snap.y, IDLE_HAND.y, ease((t - 0.27) / 0.33)) };
    crackT = -1; return { x: IDLE_HAND.x, y: IDLE_HAND.y };
  }

  function step(dt) {
    time += dt; cooldown = Math.max(0, cooldown - dt);
    var t = handTarget(dt); hand.x = t.x; hand.y = t.y;
    // 手肘：肩到手的中點往外下方推，讓手臂有彎度
    var mx = (SHOULDER.x + hand.x) / 2, my = (SHOULDER.y + hand.y) / 2, dx = hand.x - SHOULDER.x, dy = hand.y - SHOULDER.y;
    var len = Math.hypot(dx, dy) || 1, bend = Math.max(0, 15 - len * 0.3);
    elbow.x = mx + (dy / len) * bend; elbow.y = my - (dx / len) * bend;
    // Verlet 積分
    for (var i = 1; i < N; i++) {
      var p = pts[i];
      if (dragging && i === N - 1) continue;
      var vx = (p.x - p.px) * 0.985, vy = (p.y - p.py) * 0.985;
      p.px = p.x; p.py = p.y; p.x += vx; p.y += vy + 0.32;
      if (p.y > H - 3) { p.y = H - 3; p.px = p.x - vx * 0.6; }
      if (p.x < 3) p.x = 3; if (p.y < 3) p.y = 3; if (p.x > W - 3) p.x = W - 3;
    }
    if (dragging && dragPt) { var tip = pts[N - 1]; tip.px = tip.x; tip.py = tip.y; tip.x = dragPt.x; tip.y = dragPt.y; }
    // 長度約束；握把前兩節跟著前臂方向，比較硬
    var hx = hand.x - elbow.x, hy = hand.y - elbow.y, hl = Math.hypot(hx, hy) || 1;
    for (var it = 0; it < 10; it++) {
      pts[0].x = hand.x; pts[0].y = hand.y;
      pts[1].x = hand.x + hx / hl * SEG; pts[1].y = hand.y + hy / hl * SEG;
      for (var j = 1; j < N - 1; j++) {
        var a = pts[j], b = pts[j + 1], ddx = b.x - a.x, ddy = b.y - a.y, d = Math.hypot(ddx, ddy) || 0.001, diff = (d - SEG) / d;
        var lock = dragging && j + 1 === N - 1;
        if (j === 1) { b.x -= ddx * diff; b.y -= ddy * diff; }
        else if (lock) { a.x += ddx * diff; a.y += ddy * diff; }
        else { a.x += ddx * diff * 0.5; a.y += ddy * diff * 0.5; b.x -= ddx * diff * 0.5; b.y -= ddy * diff * 0.5; }
      }
    }
    // 鞭尾速度夠快＝啪
    var tp = pts[N - 1], speed = Math.hypot(tp.x - tp.px, tp.y - tp.py);
    if (speed > 13 && cooldown === 0) {
      cooldown = 0.35;
      if (interacted && (loud || dragging)) crackSound(speed);
      for (var s = 0; s < 9; s++) {
        var ang = Math.random() * Math.PI * 2, v = 1 + Math.random() * 2.5;
        sparks.push({ x: tp.x, y: tp.y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, life: 1 });
      }
    }
    for (var k = sparks.length - 1; k >= 0; k--) {
      var sp = sparks[k]; sp.x += sp.vx; sp.y += sp.vy; sp.vx *= 0.92; sp.vy *= 0.92; sp.life -= dt * 3;
      if (sp.life <= 0) sparks.splice(k, 1);
    }
    // 眼睛看滑鼠
    var head = toClient(BODY_X, 96), tx = 0, ty = 0;
    if (pointer && head) { var ex = pointer.x - head.x, ey = pointer.y - head.y, el = Math.hypot(ex, ey) || 1; tx = ex / el * 2.6; ty = ey / el * 2; }
    look.x += (tx - look.x) * 0.15; look.y += (ty - look.y) * 0.15;
    if (time > blinkAt) { blinkUntil = time + 0.12; blinkAt = time + 3 + Math.random() * 3; }
  }

  function line(pts2, w, color) {
    ctx.beginPath(); ctx.moveTo(pts2[0], pts2[1]);
    for (var i = 2; i < pts2.length; i += 2) ctx.lineTo(pts2[i], pts2[i + 1]);
    ctx.lineWidth = w; ctx.strokeStyle = color; ctx.stroke();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    var ink = '#eef2ff', bob = reduce ? 0 : Math.sin(time * 2) * 1.2;
    // 影子
    ctx.fillStyle = 'rgba(93,240,168,.12)'; ctx.beginPath(); ctx.ellipse(BODY_X, 196, 22, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    // 腿、身體、空手扠腰
    line([160, 195, BODY_X, 150 + bob, 185, 195], 4, ink);
    line([BODY_X, 150 + bob, BODY_X, 110 + bob], 4, ink);
    line([BODY_X, 118 + bob, 190, 130 + bob, 182, 144 + bob], 3.5, ink);
    // 鞭子
    ctx.save(); ctx.shadowColor = 'rgba(93,240,168,.55)'; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.moveTo(pts[1].x, pts[1].y);
    for (var i = 2; i < N - 1; i++) { var mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2; ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my); }
    ctx.lineTo(pts[N - 1].x, pts[N - 1].y);
    ctx.lineWidth = 2.4; ctx.strokeStyle = '#5df0a8'; ctx.stroke(); ctx.restore();
    line([pts[0].x, pts[0].y, pts[1].x, pts[1].y, pts[2].x, pts[2].y], 4.5, '#c9a66b');   // 握把
    // 拿鞭手臂
    line([SHOULDER.x, SHOULDER.y + bob, elbow.x, elbow.y, hand.x, hand.y], 3.5, ink);
    // 頭＋牛仔帽
    var hy = 96 + bob;
    ctx.fillStyle = '#0a1022'; ctx.beginPath(); ctx.arc(BODY_X, hy, 12, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 3.5; ctx.strokeStyle = ink; ctx.stroke();
    ctx.fillStyle = '#5df0a8';
    ctx.beginPath(); ctx.moveTo(BODY_X - 18, hy - 9); ctx.quadraticCurveTo(BODY_X, hy - 4, BODY_X + 18, hy - 9);
    ctx.quadraticCurveTo(BODY_X, hy - 11, BODY_X - 18, hy - 9); ctx.fill();
    ctx.beginPath(); ctx.moveTo(BODY_X - 9, hy - 9); ctx.lineTo(BODY_X - 7, hy - 21); ctx.quadraticCurveTo(BODY_X, hy - 17, BODY_X + 7, hy - 21);
    ctx.lineTo(BODY_X + 9, hy - 9); ctx.closePath(); ctx.fill();
    // 眼睛
    ctx.fillStyle = ink; ctx.strokeStyle = ink; ctx.lineWidth = 2;
    [-4.5, 4.5].forEach(function (o) {
      var ex = BODY_X + o + look.x, ey = hy + 1 + look.y;
      if (time < blinkUntil) { ctx.beginPath(); ctx.moveTo(ex - 2, ey); ctx.lineTo(ex + 2, ey); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(ex, ey, 1.8, 0, Math.PI * 2); ctx.fill(); }
    });
    // 火花
    sparks.forEach(function (s) { ctx.fillStyle = 'rgba(220,255,236,' + Math.max(0, s.life) + ')'; ctx.fillRect(s.x - 1.2, s.y - 1.2, 2.4, 2.4); });
  }

  function toClient(x, y) {
    var r = canvas.getBoundingClientRect(); if (!r.width) return null;
    return { x: r.left + x * r.width / W, y: r.top + y * r.height / H };
  }
  function toLocal(cx, cy) {
    var r = canvas.getBoundingClientRect();
    return { x: Math.max(3, Math.min(W - 3, (cx - r.left) * W / r.width)), y: Math.max(3, Math.min(H - 3, (cy - r.top) * H / r.height)) };
  }

  var last = performance.now(), acc = 0;
  function frame(now) {
    acc += Math.min(0.05, (now - last) / 1000); last = now;
    while (acc >= 1 / 60) { step(1 / 60); acc -= 1 / 60; }
    draw();
    var tip = pts[N - 1], rr = canvas.getBoundingClientRect(), rootR = root.getBoundingClientRect();
    grab.style.transform = 'translate(' + (rr.left - rootR.left + tip.x * rr.width / W) + 'px,' + (rr.top - rootR.top + tip.y * rr.height / H) + 'px)';
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.addEventListener('pointermove', function (e) { pointer = { x: e.clientX, y: e.clientY }; }, { passive: true });
  grab.addEventListener('pointerdown', function (e) {
    e.preventDefault(); interacted = true; dragging = true; dragPt = toLocal(e.clientX, e.clientY);
    grab.setPointerCapture(e.pointerId); grab.style.cursor = 'grabbing';
  });
  grab.addEventListener('pointermove', function (e) { if (dragging) dragPt = toLocal(e.clientX, e.clientY); });
  function release() { dragging = false; dragPt = null; grab.style.cursor = 'grab'; }
  grab.addEventListener('pointerup', release); grab.addEventListener('pointercancel', release);

  /* ---------- 對話框 ---------- */
  var CHIPS = ['Austen 是誰', '網站有哪些工具', '有什麼遊戲', '他會什麼技能', '怎麼聯絡他'];
  CHIPS.forEach(function (c) {
    var b = document.createElement('button'); b.type = 'button'; b.textContent = c;
    b.addEventListener('click', function () { ask(c); }); chips.appendChild(b);
  });

  function addMsg(who, text, links, tag) {
    var m = document.createElement('div'); m.className = 'pet-msg ' + who;
    m.textContent = text;
    if (tag) { var t = document.createElement('small'); t.textContent = ' · ' + tag; t.style.opacity = '.6'; m.appendChild(t); }
    if (links && links.length) {
      var box = document.createElement('div'); box.className = 'pet-links';
      links.forEach(function (l) {
        if (!/^(#|mailto:|[a-z0-9_-]+\.html)/i.test(l.href)) return;
        var a = document.createElement('a'); a.href = l.href; a.textContent = l.label; box.appendChild(a);
      });
      m.appendChild(box);
    }
    log.appendChild(m); log.scrollTop = log.scrollHeight; return m;
  }

  function endpoint() {
    var s = document.currentScript || document.querySelector('script[data-ai-endpoint]');
    return window.PET_AI_ENDPOINT || (s && s.getAttribute && s.getAttribute('data-ai-endpoint')) || '';
  }
  var AI_URL = endpoint();

  function askAI(q) {
    if (!AI_URL || !window.fetch) return Promise.reject();
    var ctl = window.AbortController ? new AbortController() : null, timer = setTimeout(function () { ctl && ctl.abort(); }, 6000);
    return fetch(AI_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q: q }), signal: ctl && ctl.signal })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (j) { clearTimeout(timer); if (!j || typeof j.answer !== 'string' || !j.answer.trim()) throw 0; return j.answer.trim().slice(0, 800); })
      .catch(function (e) { clearTimeout(timer); throw e; });
  }

  var busy = false;
  function ask(q) {
    q = String(q || '').trim().slice(0, 200);
    if (!q || busy) return;
    busy = true; addMsg('me', q); input.value = '';
    var typing = addMsg('bot typing', '小鞭想一下…');
    var local = window.PetBrain ? window.PetBrain.answer(q) : { text: '問答資料沒載入，晚點再試試。' };
    function done(text, links, tag) { typing.remove(); addMsg('bot', text, links, tag); busy = false; startCrack(); }
    // 本地資料命中就直接回答；沒命中且有 AI 代理時才問 AI
    if (local.id !== 'fallback' || !AI_URL) { setTimeout(function () { done(local.text, local.links); }, 320); return; }
    askAI(q).then(function (a) { done(a, null, 'AI'); }, function () { done(local.text, local.links); });
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); ask(input.value); });

  var greeted = false;
  function setOpen(open) {
    root.classList.toggle('open', open); hit.setAttribute('aria-expanded', String(open));
    if (open && !greeted) { greeted = true; addMsg('bot', '嗨，我是小鞭 🤠 想知道 Austen 的什麼？點下面的按鈕或直接打字問我。'); }
    if (open && window.matchMedia('(pointer:fine)').matches) setTimeout(function () { input.focus({ preventScroll: true }); }, 60);
  }
  hit.addEventListener('click', function () { interacted = true; startCrack(); setOpen(!root.classList.contains('open')); root.classList.remove('show-tip'); });
  root.querySelector('[data-act="close"]').addEventListener('click', function () { setOpen(false); hit.focus(); });
  muteBtn.addEventListener('click', function () { muted = !muted; store.set('pet-muted', muted ? '1' : '0'); syncMute(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && root.classList.contains('open')) { setOpen(false); hit.focus(); } });

  // 第一次來：甩一下＋提示泡泡
  if (!store.get('pet-seen')) {
    setTimeout(function () { startCrack(true); root.classList.add('show-tip'); store.set('pet-seen', '1'); }, 2200);
    setTimeout(function () { root.classList.remove('show-tip'); }, 7000);
  }
  // 閒置時偶爾自己甩一下（不出聲）
  if (!reduce) setInterval(function () { if (!document.hidden && !dragging && Math.random() < 0.5) startCrack(true); }, 14000);
})();
