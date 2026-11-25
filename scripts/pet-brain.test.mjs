import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const B = createRequire(import.meta.url)('../pet-brain.js');
const cases = [
  ['有哪些工具', 'tools'], ['網站有什麼功能？', 'tools'], ['Austen 是誰', 'austen'],
  ['你是誰', 'pet'], ['推薦午餐吃什麼', 'lunch'], ['怎麼聯絡他', 'contact'],
  ['他會什麼程式語言', 'skills'], ['想玩猜拳', 'games'], ['asdf', 'fallback'], ['', 'fallback'],
  ['<img src=x onerror=alert(1)>', 'fallback'], ['他讀哪間大學', 'school'], ['你是 AI 嗎', 'ai'],
];
for (const [q, id] of cases) assert.equal(B.answer(q).id, id, `"${q}" → ${B.answer(q).id}, 預期 ${id}`);
const t = B.answer('有哪些工具').text;
for (const w of ['分帳', '午餐', '睡眠', '噪音']) assert.ok(t.includes(w));
console.log(`pet-brain: ${cases.length} cases pass`);
