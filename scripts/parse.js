const fs = require('fs');
const path = require('path');

const raw = fs.readFileSync(path.join(__dirname, '../raw.txt'), 'utf-8');
const lines = raw.split(/\r?\n/).map(s => s.trimEnd());

const CATEGORIES = [
  { id: 'zhiqin', name: '至亲乡情' },
  { id: 'siji', name: '四季更迭' },
  { id: 'yongwu', name: '咏物感怀' },
  { id: 'jishan', name: '寄情山水' },
  { id: 'youguo', name: '忧国忧民' },
  { id: 'sanwen', name: '散文' },
];

const SECTION_MARKERS = ['一、至亲乡情', '二、四季更迭', '三、咏物感怀', '四、寄情山水', '五、忧国忧民'];
const DATE_REGEX = /(\d{4})\.(\d{1,2})\.(\d{1,2})/;
const DATE_ONLY_REGEX = /^\s*(\d{4}\.\d{1,2}\.\d{1,2})\s*$/;
const DATE_AT_END_REGEX = /(.*?)(\d{4}\.\d{1,2}\.\d{1,2})\s*$/;

function normalizeDate(s) {
  const m = String(s).match(DATE_REGEX);
  if (!m) return '';
  return `${m[1]}.${m[2].padStart(2,'0')}.${m[3].padStart(2,'0')}`;
}

function cleanContent(s) {
  if (!s || typeof s !== 'string') return s;
  return s
    .replace(/\n?第\s*\d+\s*页\s*\n?/g, '\n')
    .replace(/\n?--\s*\d+\s*of\s*\d+\s*--\s*\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parsePoetrySection(text, categoryId) {
  const items = [];
  const skipPatterns = [/^第\s*\d+\s*页\s*$/, /^--\s*\d+\s*of\s*\d+\s*--$/, /^有林诗文\s*$/, /^$/];
  let buffer = [];
  let lastDate = '';

  const flush = () => {
    if (buffer.length === 0) return;
    const last = buffer[buffer.length - 1];
    const dateMatch = last.match(/(.*?)(\d{4}\.\d{1,2}\.\d{1,2})\s*$/);
    let title = '', contentLines = [], date = '';
    if (dateMatch && dateMatch[2]) {
      date = normalizeDate(dateMatch[2]);
      const contentEnd = dateMatch[1].trim();
      if (contentEnd) {
        buffer[buffer.length - 1] = contentEnd;
      } else {
        buffer.pop();
      }
    }
    if (buffer.length > 0) {
      title = buffer[0].trim();
      contentLines = buffer.slice(1).map(s => s.trim()).filter(Boolean);
    }
    if (title && (date || contentLines.length > 0)) {
      items.push({
        id: `${categoryId}-${items.length}`,
        categoryId,
        title,
        date: date || lastDate,
        content: cleanContent(contentLines.join('\n')),
      });
    }
    if (date) lastDate = date;
    buffer = [];
  };

  for (const line of text) {
    const t = line.trim();
    if (skipPatterns.some(p => p.test(t)) || t.startsWith('--')) continue;
    if (SECTION_MARKERS.some(m => t === m)) continue;

    if (DATE_ONLY_REGEX.test(t)) {
      if (buffer.length > 0) {
        const date = normalizeDate(t.match(DATE_ONLY_REGEX)[1]);
        lastDate = date;
        const title = buffer[0].trim();
        const contentLines = buffer.slice(1).map(s => s.trim()).filter(Boolean);
        if (title) {
          items.push({
            id: `${categoryId}-${items.length}`,
            categoryId,
            title,
            date,
            content: cleanContent(contentLines.join('\n')),
          });
        }
      }
      buffer = [];
      continue;
    }

    const dateAtEnd = t.match(DATE_AT_END_REGEX);
    if (dateAtEnd && dateAtEnd[2]) {
      const contentPart = dateAtEnd[1].trim();
      const date = normalizeDate(dateAtEnd[2]);
      if (buffer.length > 0) {
        const title = buffer[0].trim();
        const contentLines = buffer.slice(1).map(s => s.trim()).filter(Boolean);
        if (contentPart) contentLines.push(contentPart);
        if (title) {
          items.push({
            id: `${categoryId}-${items.length}`,
            categoryId,
            title,
            date,
            content: cleanContent(contentLines.join('\n')),
          });
        }
      }
      lastDate = date;
      buffer = [];
      continue;
    }

    buffer.push(line);
  }
  flush();
  return items;
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
          if (next.includes('自述')) {
            end = j;
            break;
          }
          end = j;
          break;
        }
      }
      ranges.push({ sectionIndex: idx, start, end });
    }
    if (t.includes('自述') && /\d{4}\.\d{1,2}\.\d{1,2}/.test(t)) {
      const start = i;
      ranges.push({ sectionIndex: 5, start, end: lines.length });
      break;
    }
    i++;
  }
  return ranges;
}

const ranges = findSectionRanges();
const allItems = [];
let globalIndex = 0;

for (const r of ranges) {
  const categoryId = CATEGORIES[r.sectionIndex].id;
  const sectionLines = lines.slice(r.start, r.end);
  if (r.sectionIndex === 5) {
    const proseTitles = ['自述', '新年话收获', '话家史', '老屋', '老嫂比母', '侄儿二次出国有感', '书法难', '大实话', '荷花村的龙脉', '高家湾中学赞', '荷花村晒经坡记', '孙悟空落座东庵庙', '荷花村东庵庙的传说', '淇河鲫鱼进贡记'];
    let currentTitle = '';
    let currentContent = [];
    let currentDate = '';
    const flushProse = () => {
      if (currentTitle && (currentContent.length > 0 || currentDate)) {
        allItems.push({
          id: `sanwen-${globalIndex++}`,
          categoryId: 'sanwen',
          title: currentTitle,
          date: currentDate,
          content: cleanContent(currentContent.join('\n')),
        });
      }
    };
    for (const line of sectionLines) {
      const t = line.trim();
      const dateMatch = t.match(/(.*?)(\d{4}\.\d{1,2}\.\d{1,2})\s*$/);
      const titlePart = dateMatch ? dateMatch[1].trim() : t;
      const isProseStart = proseTitles.some(tit => titlePart === tit || titlePart.startsWith(tit + ' ') || titlePart.startsWith(tit + '（'));
      if (dateMatch && dateMatch[2] && isProseStart) {
        flushProse();
        currentTitle = titlePart;
        currentDate = normalizeDate(dateMatch[2]);
        currentContent = [];
      } else if (!dateMatch && proseTitles.some(tit => t === tit || t.startsWith(tit + ' '))) {
        flushProse();
        currentTitle = t;
        currentDate = '';
        currentContent = [];
      } else if (dateMatch && dateMatch[2] && currentTitle) {
        if (dateMatch[1].trim()) currentContent.push(dateMatch[1].trim());
        currentDate = normalizeDate(dateMatch[2]);
      } else if (currentTitle && t) {
        currentContent.push(t);
      }
    }
    flushProse();
  } else {
    const items = parsePoetrySection(sectionLines, categoryId);
    items.forEach(it => {
      it.id = `${categoryId}-${globalIndex++}`;
      allItems.push(it);
    });
  }
}

const output = {
  categories: CATEGORIES,
  items: allItems,
};
fs.writeFileSync(path.join(__dirname, '../data/poems.json'), JSON.stringify(output, null, 2), 'utf-8');
console.log('Total items:', allItems.length);
console.log('By category:', CATEGORIES.map(c => ({ ...c, count: allItems.filter(i => i.categoryId === c.id).length })));
