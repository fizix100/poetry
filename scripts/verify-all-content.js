/**
 * 从 raw.txt 按行提取每篇诗文的「期望正文」，与 data/poems.json 逐条比对，确保一字不差。
 * 用法: node scripts/verify-all-content.js
 */
const fs = require('fs');
const path = require('path');

const raw = fs.readFileSync(path.join(__dirname, '../raw.txt'), 'utf-8');
const lines = raw.split(/\r?\n/).map(s => s.trimEnd());

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/poems.json'), 'utf-8'));

const SECTION_MARKERS = ['一、至亲乡情', '二、四季更迭', '三、咏物感怀', '四、寄情山水', '五、忧国忧民'];
const DATE_ONLY_REGEX = /^\s*(\d{4}\.\d{1,2}\.\d{1,2})\s*$/;
const DATE_AT_END_REGEX = /(.*?)(\d{4}\.\d{1,2}\.\d{1,2})\s*$/;

function cleanContent(s) {
  if (!s || typeof s !== 'string') return s;
  return s
    .replace(/\n?第\s*\d+\s*页\s*\n?/g, '\n')
    .replace(/\n?--\s*\d+\s*of\s*\d+\s*--\s*\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function findSectionRanges() {
  const ranges = [];
  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    const idx = SECTION_MARKERS.indexOf(t);
    if (idx >= 0) {
      const start = i + 1;
      let end = lines.length;
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j].trim();
        if (SECTION_MARKERS.includes(next) || (next.includes('自述') && /\d{4}\.\d{1,2}\.\d{1,2}/.test(next))) {
          end = j;
          break;
        }
      }
      ranges.push({ sectionIndex: idx, start, end });
    }
    if (t.includes('自述') && /\d{4}\.\d{1,2}\.\d{1,2}/.test(t)) {
      ranges.push({ sectionIndex: 5, start: i, end: lines.length });
      break;
    }
    i++;
  }
  return ranges;
}

/** 从 raw 的诗体段落中按行精确提取每篇的 title + content（不丢一行） */
function extractPoetryBlocks(sectionLines) {
  const skipPatterns = [/^第\s*\d+\s*页\s*$/, /^--\s*\d+\s*of\s*\d+\s*--$/, /^有林诗文\s*$/, /^$/];
  const blocks = [];
  let title = '';
  let contentLines = [];

  for (const line of sectionLines) {
    const t = line.trim();
    if (skipPatterns.some(p => p.test(t)) || t.startsWith('--')) continue;
    if (SECTION_MARKERS.includes(t)) continue;

    if (DATE_ONLY_REGEX.test(t)) {
      if (title) {
        blocks.push({ title, content: contentLines.map(s => s.trim()).filter(Boolean).join('\n') });
        title = '';
        contentLines = [];
      }
      continue;
    }

    const dateAtEnd = t.match(DATE_AT_END_REGEX);
    if (dateAtEnd && dateAtEnd[2]) {
      const contentPart = dateAtEnd[1].trim();
      if (title) {
        if (contentPart) contentLines.push(contentPart);
        blocks.push({ title, content: contentLines.map(s => s.trim()).filter(Boolean).join('\n') });
        title = '';
        contentLines = [];
      }
      continue;
    }

    if (!title) {
      title = t;
    } else {
      contentLines.push(line);
    }
  }
  if (title) {
    blocks.push({ title, content: contentLines.map(s => s.trim()).filter(Boolean).join('\n') });
  }
  return blocks;
}

/** 散文段落的标题列表（与 parse.js 一致） */
const PROSE_TITLES = ['自述', '新年话收获', '话家史', '老屋', '老嫂比母', '侄儿二次出国有感', '书法难', '大实话', '荷花村的龙脉', '高家湾中学赞', '荷花村晒经坡记', '孙悟空落座东庵庙', '荷花村东庵庙的传说', '淇河鲫鱼进贡记'];

function extractProseBlocks(sectionLines) {
  const blocks = [];
  let currentTitle = '';
  let currentContent = [];

  for (const line of sectionLines) {
    const t = line.trim();
    const dateMatch = t.match(/(.*?)(\d{4}\.\d{1,2}\.\d{1,2})\s*$/);
    const titlePart = dateMatch ? dateMatch[1].trim() : t;
    const isProseStart = PROSE_TITLES.some(tit => titlePart === tit || titlePart.startsWith(tit + ' ') || titlePart.startsWith(tit + '（') || titlePart.startsWith(tit + '  '));

    if (dateMatch && dateMatch[2] && isProseStart) {
      if (currentTitle) {
        blocks.push({ title: currentTitle, content: currentContent.join('\n') });
      }
      currentTitle = titlePart;
      currentContent = [];
    } else if (!dateMatch && PROSE_TITLES.some(tit => t === tit || t.startsWith(tit + ' ') || t.startsWith(tit + '  '))) {
      if (currentTitle) {
        blocks.push({ title: currentTitle, content: currentContent.join('\n') });
      }
      currentTitle = t;
      currentContent = [];
    } else if (dateMatch && dateMatch[2] && currentTitle) {
      if (dateMatch[1].trim()) currentContent.push(dateMatch[1].trim());
    } else if (currentTitle && t) {
      currentContent.push(t);
    }
  }
  if (currentTitle) {
    blocks.push({ title: currentTitle, content: currentContent.join('\n') });
  }
  return blocks;
}

function normalize(s) {
  return cleanContent(s || '').replace(/\r/g, '').replace(/\n{2,}/g, '\n').trim();
}

const ranges = findSectionRanges();
const expectedByIndex = [];
const categoryIds = ['zhiqin', 'siji', 'yongwu', 'jishan', 'youguo', 'sanwen'];

for (const r of ranges) {
  const sectionLines = lines.slice(r.start, r.end);
  const blocks = r.sectionIndex === 5 ? extractProseBlocks(sectionLines) : extractPoetryBlocks(sectionLines);
  const cid = categoryIds[r.sectionIndex];
  blocks.forEach(b => {
    expectedByIndex.push({
      categoryId: cid,
      title: b.title.trim(),
      expectedContent: b.content,
    });
  });
}

const items = data.items;
const errors = [];

for (let i = 0; i < items.length; i++) {
  const item = items[i];
  const exp = expectedByIndex[i];
  if (!exp) {
    errors.push({ index: i, id: item.id, title: item.title, type: 'no_expected', message: 'raw 中无对应篇' });
    continue;
  }
  const normJson = normalize(item.content);
  const normRaw = normalize(exp.expectedContent);

  if (normJson !== normRaw) {
    const jsonLen = normJson.length;
    const rawLen = normRaw.length;
    let message = `字数不一致: JSON=${jsonLen} raw=${rawLen}`;
    if (normRaw.length > normJson.length) {
      message += ' (JSON 少内容)';
    } else if (normRaw.length < normJson.length) {
      message += ' (JSON 多内容)';
    } else {
      message += ' (内容不同)';
    }
    errors.push({
      index: i,
      id: item.id,
      title: item.title,
      type: 'mismatch',
      message,
      expectedPreview: normRaw.slice(0, 200) + (normRaw.length > 200 ? '...' : ''),
      actualPreview: normJson.slice(0, 200) + (normJson.length > 200 ? '...' : ''),
      expectedFull: normRaw,
      actualFull: normJson,
    });
  }
  if (exp.title.trim() !== item.title) {
    errors.push({
      index: i,
      id: item.id,
      title: item.title,
      expectedTitle: exp.title.trim(),
      type: 'title_mismatch',
      message: `标题不一致: "${item.title}" vs "${exp.title.trim()}"`,
    });
  }
}

if (expectedByIndex.length !== items.length) {
  console.log(`篇数: JSON=${items.length} raw提取=${expectedByIndex.length}`);
  errors.push({ type: 'count_mismatch', jsonCount: items.length, rawCount: expectedByIndex.length });
}

if (errors.length === 0) {
  console.log('通过: 所有篇目正文与 raw.txt 一致，一字不差。');
  console.log('总篇数: ' + items.length);
  process.exit(0);
}

console.log(`发现 ${errors.length} 处不一致:\n`);
errors.forEach((e, i) => {
  console.log(`[${i + 1}] ${e.id} 《${e.title}》 ${e.message}`);
  if (e.expectedFull != null && e.actualFull != null) {
    console.log('--- raw 期望 (前 300字) ---');
    console.log(e.expectedFull.slice(0, 300));
    console.log('--- JSON 当前 (前 300字) ---');
    console.log(e.actualFull.slice(0, 300));
    console.log('---');
  }
});

fs.writeFileSync(
  path.join(__dirname, '../verify-report.json'),
  JSON.stringify(errors.map(e => ({
    ...e,
    expectedFull: e.expectedFull != null ? e.expectedFull : undefined,
    actualFull: e.actualFull != null ? e.actualFull : undefined,
  })), null, 2),
  'utf-8'
);
console.log('\n已写入 verify-report.json');
process.exit(1);
