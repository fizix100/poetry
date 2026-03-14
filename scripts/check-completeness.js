#!/usr/bin/env node
/**
 * 检查 data/poems.json 完整性：空内容、过短内容、重复标题等
 */
const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/poems.json'), 'utf-8'));
const items = data.items;

const empty = items.filter((i) => !i.content || !i.content.trim());
const short = items.filter((i) => i.content && i.content.trim().length < 10);
const byTitle = {};
items.forEach((i) => {
  byTitle[i.title] = (byTitle[i.title] || 0) + 1;
});
const dupTitles = Object.entries(byTitle).filter(([, n]) => n > 1);

console.log('合计:', items.length, '篇');
console.log('分类:', data.categories.map((c) => c.name + ' ' + items.filter((i) => i.categoryId === c.id).length).join(', '));
console.log('');
if (empty.length) {
  console.log('【无正文】', empty.length, '篇:', empty.map((i) => i.title).join(', '));
} else {
  console.log('【无正文】 0 篇');
}
if (short.length) {
  console.log('【正文过短 <10 字】', short.length, '篇:', short.map((i) => i.title).slice(0, 10).join(', '));
}
if (dupTitles.length) {
  console.log('【重复标题】', dupTitles.length, '个:', dupTitles.slice(0, 5).map(([t]) => t).join(', '), '...');
}
console.log('');
console.log('检查完成。若有遗漏请检查 raw.txt 是否完整，并重新运行 node scripts/parse.js');
