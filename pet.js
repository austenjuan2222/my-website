/* 角落火柴人小寵物「小鞭」：Verlet 鞭子＋個人問答。需先載入 pet-brain.js。
 * 桌機會跟著滑鼠走（不擋點擊），點畫面空白處就甩鞭；觸控裝置留在右下角。
 * AI：設定 window.PET_AI_ENDPOINT（代理見 worker/pet-ai.js），失敗時自動用本地問答。 */
(function () {
  'use strict';
  if (window.__petLoaded) return; window.__petLoaded = true;

  var W = 300, H = 240, OX = 80, OY = 40;        // 畫布邏輯座標；火柴人座標系＝畫布再偏移 (OX, OY)，左上留空間給鞭子
  var FOOT = { x: 172 + OX, y: 196 + OY };       // 畫布內腳的位置（定位基準）
  var GROUND = 198;                              // 火柴人座標系的地面
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
                set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  var muted = store.get('pet-sound') !== '1';    // 音效預設關閉
  var followPref = store.get('pet-follow') !== '0';
  function canFollow() { return finePointer; }   // 減少動態時仍可跟隨（由使用者的滑鼠帶動），只關掉自動動畫
  function following() { return canFollow() && followPref; }

  /* ---------- DOM ---------- */
  var root = document.createElement('div');
  root.className = 'pet';
  root.innerHTML =
    '<div class="pet-tip" aria-hidden="true"></div>' +
    '<section class="pet-chat" id="pet-chat" role="dialog" aria-label="小鞭：Austen 的網站助理">' +
      '<div class="pet-head"><span aria-hidden="true">🤠</span><b>小鞭</b><small>Austen 的網站助理</small><span class="sp"></span>' +
        '<button class="pet-icon" type="button" data-act="follow" hidden></button>' +
        '<button class="pet-icon" type="button" data-act="mute"></button>' +
        '<button class="pet-icon" type="button" data-act="close" aria-label="關閉對話">✕</button></div>' +
      '<div class="pet-log" aria-live="polite"></div>' +
      '<div class="pet-chips"></div>' +
      '<form class="pet-form"><input type="text" maxlength="200" placeholder="問我 Austen 或網站的事…" aria-label="輸入問題" enterkeyhint="send">' +
        '<button type="submit">問</button></form>' +
    '</section>' +
    '<button class="pet-launch" type="button" aria-expanded="false" aria-controls="pet-chat"><span aria-hidden="true">🤠</span> 問小鞭</button>';
  document.body.appendChild(root);

  var canvas = document.createElement('canvas');
  canvas.className = 'pet-canvas'; canvas.setAttribute('aria-hidden', 'true');
  var hit = document.createElement('button');
  hit.className = 'pet-hit'; hit.type = 'button'; hit.title = '點我問問題';
  hit.setAttribute('aria-label', '小鞭：點我甩鞭子並開啟問答'); hit.setAttribute('aria-expanded', 'false'); hit.setAttribute('aria-controls', 'pet-chat');
  var grab = document.createElement('div');       // 鞭尾抓取點（角落模式才有）
  grab.className = 'pet-grab'; grab.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas); document.body.appendChild(hit); document.body.appendChild(grab);

  var ctx = canvas.getContext('2d');
  var launch = root.querySelector('.pet-launch'), tip = root.querySelector('.pet-tip');
  var log = root.querySelector('.pet-log'), chips = root.querySelector('.pet-chips');
  var form = root.querySelector('form'), input = form.querySelector('input');
  var muteBtn = root.querySelector('[data-act="mute"]'), followBtn = root.querySelector('[data-act="follow"]');

  var cssW = 220, cssH = 200, scale = 1;
  function sizeCanvas() {
    var small = innerWidth <= 600;
    scale = small ? 0.7 : 1; cssW = W * scale; cssH = H * scale;
    canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  }
  sizeCanvas();

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

  /* ---------- 位置：feet＝腳在螢幕上的座標 ---------- */
  function homeFeet() {
    if (following()) {
      var chat = root.classList.contains('open') ? root.querySelector('.pet-chat').getBoundingClientRect() : null;
      if (chat && chat.width) return { x: Math.max(FOOT.x * scale, chat.left - (W - FOOT.x) * scale - 4), y: innerHeight - 6 };
      return { x: innerWidth - (W - FOOT.x) * scale - 8, y: innerHeight - 58 };
    }
    return { x: innerWidth - (W - FOOT.x) * scale - 8, y: innerHeight - 6 };
  }
  function clampFeet(p) {
    return { x: Math.max(70 * scale, Math.min(innerWidth - (W - FOOT.x) * scale, p.x)),
             y: Math.max(150 * scale, Math.min(innerHeight - (H - FOOT.y) * scale, p.y)) };
  }
  var feet = homeFeet(), pointer = null, pointerIn = false;

  /* ---------- 火柴人與鞭子 ---------- */
  var SHOULDER = { x: 172, y: 118 }, IDLE_HAND = { x: 146, y: 132 };
  var N = 26, SEG = 6, pts = [];
  for (var i = 0; i < N; i++) pts.push({ x: IDLE_HAND.x - i * 2, y: IDLE_HAND.y + i * SEG * 0.95, px: IDLE_HAND.x - i * 2, py: IDLE_HAND.y + i * SEG * 0.95 });
  var hand = { x: IDLE_HAND.x, y: IDLE_HAND.y }, elbow = { x: 158, y: 130 };
  var crackT = -1, crackDir = { x: -0.92, y: 0.38 }, loud = false, cooldown = 0, sparks = [], dragging = false, dragPt = null;
  var look = { x: 0, y: 0 }, blinkAt = 2.5, blinkUntil = 0, time = 0, interacted = false, walkPhase = 0, walkSpeed = 0, walkDir = -1;
  var rings = [], kicked = false;

  function ease(t) { return 1 - Math.pow(1 - t, 3); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function startCrack(silent, target) {
    if (crackT >= 0 || (reduce && silent)) return;   // 減少動態：不自動甩，使用者點擊才甩
    crackT = 0; loud = !silent; kicked = false;
    if (target) {
      var dx = target.x - SHOULDER.x, dy = target.y - SHOULDER.y, l = Math.hypot(dx, dy) || 1;
      crackDir = { x: Math.min(-0.25, dx / l), y: dy / l }; var l2 = Math.hypot(crackDir.x, crackDir.y); crackDir.x /= l2; crackDir.y /= l2;
    } else crackDir = { x: -0.92, y: 0.38 };
  }

  function handTarget(dt) {
    var bob = reduce ? 0 : Math.sin(time * 2) * 1.2;
    if (crackT < 0) return { x: IDLE_HAND.x + (reduce ? 0 : Math.sin(time * 1.3) * 2), y: IDLE_HAND.y + bob };
    crackT += dt;
    // 大幅後拉過頭 → 0.08 秒內猛力揮出 → 收回
    var wind = { x: SHOULDER.x - crackDir.x * 30 + 10, y: SHOULDER.y - crackDir.y * 30 - 52 };
    var snap = { x: SHOULDER.x + crackDir.x * 58, y: SHOULDER.y + crackDir.y * 58 }, t = crackT;
    if (t < 0.16) return { x: lerp(IDLE_HAND.x, wind.x, ease(t / 0.16)), y: lerp(IDLE_HAND.y, wind.y, ease(t / 0.16)) };
    if (t < 0.24) {
      if (!kicked) {   // 揮出瞬間給整條鞭子一股往前的力，越靠近鞭尾越大
        kicked = true;
        for (var i = 2; i < N; i++) { var f = 16 * Math.pow(i / N, 1.6); pts[i].px -= crackDir.x * f; pts[i].py -= crackDir.y * f - f * 0.25; }
      }
      return { x: lerp(wind.x, snap.x, ease((t - 0.16) / 0.08)), y: lerp(wind.y, snap.y, ease((t - 0.16) / 0.08)) };
    }
    if (t < 0.6) return { x: lerp(snap.x, IDLE_HAND.x, ease((t - 0.24) / 0.36)), y: lerp(snap.y, IDLE_HAND.y, ease((t - 0.24) / 0.36)) };
    crackT = -1; return { x: IDLE_HAND.x, y: IDLE_HAND.y };
  }

  var moveGoal = null;
  function moveFeet() {
    var target;
    if (following() && pointer && pointerIn && !root.classList.contains('open')) {
      // 牽繩式跟隨：游標離小鞭身體 170px 以內就站著不動（方便直接點牠、也比較不擋字）
      var body = { x: feet.x, y: feet.y - 70 * scale };
      if (!moveGoal || Math.hypot(pointer.x - body.x, pointer.y - body.y) > 170 * scale) moveGoal = clampFeet({ x: pointer.x + 70, y: pointer.y + 100 });
      target = moveGoal;
    } else { moveGoal = null; target = clampFeet(homeFeet()); }
    var dx = target.x - feet.x, dy = target.y - feet.y, d = Math.hypot(dx, dy);
    var sp = Math.min(d * 0.09, 11);
    var mx = d > 0.5 ? dx / d * sp : 0, my = d > 0.5 ? dy / d * sp : 0;
    feet.x += mx; feet.y += my; walkSpeed = sp;
    if (mx > 0.4) walkDir = 1; else if (mx < -0.4) walkDir = -1;
    // 畫布跟著移動：鞭子留在原本的世界位置（保留慣性，所以走動時會拖著甩）
    var lx = mx / scale, ly = my / scale;
    for (var i = 1; i < N; i++) { pts[i].x -= lx; pts[i].y -= ly; pts[i].px -= lx; pts[i].py -= ly; }
    for (var k = 0; k < sparks.length; k++) { sparks[k].x -= lx; sparks[k].y -= ly; }
    for (var q = 0; q < rings.length; q++) { rings[q].x -= lx; rings[q].y -= ly; }
  }

  function step(dt) {
    time += dt; cooldown = Math.max(0, cooldown - dt);
    if (!dragging) moveFeet();
    walkPhase += walkSpeed * 0.09;
    var t = handTarget(dt); hand.x = t.x; hand.y = t.y;
    var mx = (SHOULDER.x + hand.x) / 2, my = (SHOULDER.y + hand.y) / 2, dx = hand.x - SHOULDER.x, dy = hand.y - SHOULDER.y;
    var len = Math.hypot(dx, dy) || 1, bend = Math.max(0, 15 - len * 0.3);
    elbow.x = mx + (dy / len) * bend; elbow.y = my - (dx / len) * bend;
    // Verlet 積分
    for (var i = 1; i < N; i++) {
      var p = pts[i];
      if (dragging && i === N - 1) continue;
      var vx = (p.x - p.px) * 0.985, vy = (p.y - p.py) * 0.985;
      p.px = p.x; p.py = p.y; p.x += vx; p.y += vy + 0.32;
      if (p.y > GROUND) { p.y = GROUND; p.px = p.x - vx * 0.6; }
    }
    if (dragging && dragPt) { var tp0 = pts[N - 1]; tp0.px = tp0.x; tp0.py = tp0.y; tp0.x = dragPt.x; tp0.y = dragPt.y; }
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
      rings.push({ x: tp.x, y: tp.y, r: 2, life: 1 });
      for (var s = 0; s < 16; s++) {
        var ang = Math.random() * Math.PI * 2, v = 1.5 + Math.random() * 4;
        sparks.push({ x: tp.x, y: tp.y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, life: 1 });
      }
    }
    for (var k = sparks.length - 1; k >= 0; k--) {
      var sp = sparks[k]; sp.x += sp.vx; sp.y += sp.vy; sp.vx *= 0.92; sp.vy *= 0.92; sp.life -= dt * 3;
      if (sp.life <= 0) sparks.splice(k, 1);
    }
    for (var rr = rings.length - 1; rr >= 0; rr--) { rings[rr].r += 2.2; rings[rr].life -= dt * 3.2; if (rings[rr].life <= 0) rings.splice(rr, 1); }
    // 眼睛看滑鼠
    var head = toClient(172, 96), tx = 0, ty = 0;
    if (pointer && head) { var ex = pointer.x - head.x, ey = pointer.y - head.y, el = Math.hypot(ex, ey) || 1; tx = ex / el * 2.6; ty = ey / el * 2; }
    look.x += (tx - look.x) * 0.15; look.y += (ty - look.y) * 0.15;
    if (time > blinkAt) { blinkUntil = time + 0.12; blinkAt = time + 3 + Math.random() * 3; }
  }

  function line(p, w, color) {
    ctx.beginPath(); ctx.moveTo(p[0], p[1]);
    for (var i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
    ctx.lineWidth = w; ctx.strokeStyle = color; ctx.stroke();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save(); ctx.translate(OX, OY);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    var ink = '#eef2ff', walking = walkSpeed > 0.6, bob = reduce ? 0 : (walking ? Math.abs(Math.sin(walkPhase)) * -2 : Math.sin(time * 2) * 1.2);
    var sw = walking ? Math.sin(walkPhase) * 12 : 0, lift = walking ? Math.max(0, Math.cos(walkPhase)) * 4 : 0;
    var skip = walking && walkDir > 0, hop = 0, lean = 0;
    if (skip && !reduce) { hop = Math.abs(Math.sin(walkPhase * 0.75)) * 11; bob = -hop; lean = 5; }   // 往右走：蹦蹦跳的跳步
    ctx.fillStyle = 'rgba(93,240,168,.12)'; ctx.beginPath(); ctx.ellipse(172, 196, 22, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    if (skip) {
      var k = Math.sin(walkPhase * 0.75);   // 一腳往前踢、一腳彎膝收起
      line([172, 150 + bob, 180 + k * 6, 172 + bob, 186 + k * 10, 194 - hop * 0.6], 4, ink);
      line([172, 150 + bob, 170 - k * 4, 170 + bob, 160 - k * 4, 186 + bob * 0.4], 4, ink);
      line([172, 150 + bob, 172 + lean, 110 + bob], 4, ink);
      line([172 + lean * 0.8, 118 + bob, 194 + lean, 112 + bob - hop * 0.6, 200 + lean, 100 + bob - hop], 3.5, ink);   // 空手高舉
    } else {
      line([160 + sw, 195 - lift, 172, 150 + bob, 185 - sw, 195 - (walking ? Math.max(0, -Math.cos(walkPhase)) * 4 : 0)], 4, ink);
      line([172, 150 + bob, 172, 110 + bob], 4, ink);
      line([172, 118 + bob, 190, 130 + bob, 182, 144 + bob], 3.5, ink);
    }
    // 鞭子
    ctx.save(); ctx.shadowColor = 'rgba(93,240,168,.55)'; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.moveTo(pts[1].x, pts[1].y);
    for (var i = 2; i < N - 1; i++) { var mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2; ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my); }
    ctx.lineTo(pts[N - 1].x, pts[N - 1].y);
    ctx.lineWidth = 2.4; ctx.strokeStyle = '#5df0a8'; ctx.stroke(); ctx.restore();
    line([pts[0].x, pts[0].y, pts[1].x, pts[1].y, pts[2].x, pts[2].y], 4.5, '#c9a66b');
    line([SHOULDER.x, SHOULDER.y + bob, elbow.x, elbow.y, hand.x, hand.y], 3.5, ink);
    // 頭＋牛仔帽
    var hy = 96 + bob;
    ctx.fillStyle = '#0a1022'; ctx.beginPath(); ctx.arc(172, hy, 12, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 3.5; ctx.strokeStyle = ink; ctx.stroke();
    ctx.fillStyle = '#5df0a8';
    ctx.beginPath(); ctx.moveTo(154, hy - 9); ctx.quadraticCurveTo(172, hy - 4, 190, hy - 9); ctx.quadraticCurveTo(172, hy - 11, 154, hy - 9); ctx.fill();
    ctx.beginPath(); ctx.moveTo(163, hy - 9); ctx.lineTo(165, hy - 21); ctx.quadraticCurveTo(172, hy - 17, 179, hy - 21); ctx.lineTo(181, hy - 9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = ink; ctx.strokeStyle = ink; ctx.lineWidth = 2;
    [-4.5, 4.5].forEach(function (o) {
      var ex = 172 + o + look.x, ey = hy + 1 + look.y;
      if (time < blinkUntil) { ctx.beginPath(); ctx.moveTo(ex - 2, ey); ctx.lineTo(ex + 2, ey); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(ex, ey, 1.8, 0, Math.PI * 2); ctx.fill(); }
    });
    sparks.forEach(function (s) { ctx.fillStyle = 'rgba(220,255,236,' + Math.max(0, s.life) + ')'; ctx.fillRect(s.x - 1.6, s.y - 1.6, 3.2, 3.2); });
    rings.forEach(function (g) { ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(93,240,168,' + Math.max(0, g.life) * 0.8 + ')'; ctx.stroke(); });
    ctx.restore();
  }

  function origin() { return { x: feet.x - FOOT.x * scale, y: feet.y - FOOT.y * scale }; }
  // 以下兩個函式都用火柴人座標系（畫布座標減 OX/OY）
  function toClient(x, y) { var o = origin(); return { x: o.x + (x + OX) * scale, y: o.y + (y + OY) * scale }; }
  function toLocal(cx, cy) { var o = origin(); return { x: (cx - o.x) / scale - OX, y: (cy - o.y) / scale - OY }; }

  // 壓到文字時變淡，避免擋住閱讀
  var TEXTY = /^(P|H[1-6]|LI|A|SPAN|STRONG|EM|B|I|LABEL|TD|TH|BLOCKQUOTE|SMALL|CODE)$/;
  var faded = false;
  function checkOverlap() {
    if (!following()) { if (faded) { canvas.classList.remove('faded'); faded = false; } return; }
    var hit2 = false, probes = [[172, 120], [172, 170], [140, 140]];
    for (var i = 0; i < probes.length && !hit2; i++) {
      var c = toClient(probes[i][0], probes[i][1]), el = document.elementFromPoint(c.x, c.y);
      if (el && !root.contains(el) && TEXTY.test(el.tagName)) hit2 = true;
    }
    if (hit2 !== faded) { faded = hit2; canvas.classList.toggle('faded', faded); }
  }
  setInterval(checkOverlap, 250);

  var last = performance.now(), acc = 0;
  function frame(now) {
    acc += Math.min(0.05, (now - last) / 1000); last = now;
    while (acc >= 1 / 60) { step(1 / 60); acc -= 1 / 60; }
    draw();
    var o = origin();
    canvas.style.transform = 'translate(' + o.x + 'px,' + o.y + 'px)';
    var tipC = toClient(pts[N - 1].x, pts[N - 1].y);
    grab.style.transform = 'translate(' + tipC.x + 'px,' + tipC.y + 'px)';
    hit.style.transform = 'translate(' + (feet.x - hit.offsetWidth / 2) + 'px,' + (feet.y - 120 * scale) + 'px)';
    requestAnimationFrame(frame);
  }

  function applyMode() {
    var f = following();
    document.documentElement.classList.toggle('pet-follow', f);
    followBtn.hidden = !canFollow();
    followBtn.textContent = followPref ? '🐾' : '📌';
    followBtn.setAttribute('aria-label', followPref ? '讓小鞭待在角落' : '讓小鞭跟著滑鼠');
    followBtn.title = followBtn.getAttribute('aria-label');
    tip.textContent = f ? '點我問問題，點畫面空白處我就甩鞭！' : '點我問問題，或拖鞭子甩甩看！';
  }
  function syncMute() {
    muteBtn.textContent = muted ? '🔇' : '🔊';
    muteBtn.setAttribute('aria-label', muted ? '開啟鞭子音效' : '關閉鞭子音效');
    muteBtn.title = muteBtn.getAttribute('aria-label');
  }
  applyMode(); syncMute();
  requestAnimationFrame(frame);

  window.addEventListener('resize', function () { sizeCanvas(); feet = clampFeet(feet); });
  window.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse') { pointer = { x: e.clientX, y: e.clientY }; pointerIn = true; } }, { passive: true });
  document.documentElement.addEventListener('mouseleave', function () { pointerIn = false; });
  window.addEventListener('blur', function () { pointerIn = false; });

  // 點畫面空白處＝朝那裡甩鞭（連結、按鈕、輸入框不算）
  document.addEventListener('pointerdown', function (e) {
    if (!following() || e.button !== 0 || e.pointerType !== 'mouse') return;
    if (e.target.closest && e.target.closest('a,button,input,textarea,select,label,summary,[contenteditable],[role="button"],.pet,.pet-grab')) return;
    interacted = true; startCrack(false, toLocal(e.clientX, e.clientY));
  }, true);

  grab.addEventListener('pointerdown', function (e) {
    e.preventDefault(); interacted = true; dragging = true; dragPt = toLocal(e.clientX, e.clientY);
    grab.setPointerCapture(e.pointerId); grab.style.cursor = 'grabbing';
  });
  grab.addEventListener('pointermove', function (e) { if (dragging) { var p = toLocal(e.clientX, e.clientY); dragPt = { x: Math.max(3 - OX, Math.min(W - OX - 3, p.x)), y: Math.max(3 - OY, Math.min(GROUND, p.y)) }; } });
  function release() { dragging = false; dragPt = null; grab.style.cursor = ''; }
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

  var AI_URL = window.PET_AI_ENDPOINT || '';
  function askAI(q) {
    if (!AI_URL || !window.fetch) return Promise.reject();
    var ctl = window.AbortController ? new AbortController() : null, timer = setTimeout(function () { ctl && ctl.abort(); }, 8000);
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
    var local = window.PetBrain ? window.PetBrain.answer(q) : { id: 'fallback', text: '問答資料沒載入，晚點再試試。' };
    function done(text, links, tag) { typing.remove(); addMsg('bot', text, links, tag); busy = false; startCrack(true); }
    if (local.id !== 'fallback' || !AI_URL) { setTimeout(function () { done(local.text, local.links); }, 320); return; }
    askAI(q).then(function (a) { done(a, null, 'AI'); }, function () { done(local.text, local.links); });
  }
  form.addEventListener('submit', function (e) { e.preventDefault(); ask(input.value); });

  var greeted = false;
  function setOpen(open) {
    root.classList.toggle('open', open);
    hit.setAttribute('aria-expanded', String(open)); launch.setAttribute('aria-expanded', String(open));
    root.classList.remove('show-tip');
    if (open && !greeted) { greeted = true; addMsg('bot', '嗨，我是小鞭 🤠 想知道 Austen 的什麼？點下面的按鈕或直接打字問我。'); }
    if (open && finePointer) setTimeout(function () { input.focus({ preventScroll: true }); }, 60);
  }
  function toggle() { interacted = true; startCrack(false); setOpen(!root.classList.contains('open')); }
  hit.addEventListener('click', toggle);
  launch.addEventListener('click', toggle);
  root.querySelector('[data-act="close"]').addEventListener('click', function () { setOpen(false); (following() ? launch : hit).focus(); });
  muteBtn.addEventListener('click', function () { muted = !muted; store.set('pet-sound', muted ? '0' : '1'); syncMute(); });
  followBtn.addEventListener('click', function () { followPref = !followPref; store.set('pet-follow', followPref ? '1' : '0'); applyMode(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && root.classList.contains('open')) { setOpen(false); (following() ? launch : hit).focus(); } });

  // 第一次來：甩一下＋提示泡泡
  if (!store.get('pet-seen-3')) {
    setTimeout(function () { startCrack(true); root.classList.add('show-tip'); store.set('pet-seen-3', '1'); }, 2200);
    setTimeout(function () { root.classList.remove('show-tip'); }, 8000);
  }
  if (!reduce) setInterval(function () { if (!document.hidden && !dragging && !following() && Math.random() < 0.5) startCrack(true); }, 14000);
})();
