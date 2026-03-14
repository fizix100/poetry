(function () {
  'use strict';

  const DATA_URL = 'data/poems.json';
  let cached = null;

  async function loadData() {
    if (cached) return cached;
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error('Failed to load data');
    cached = await res.json();
    return cached;
  }

  function getCategoryIdFromQuery() {
    const params = new URLSearchParams(location.search);
    return params.get('category') || '';
  }

  function getIdFromQuery() {
    const params = new URLSearchParams(location.search);
    return params.get('id') || '';
  }

  function parseDate(s) {
    if (!s) return 0;
    const parts = s.split('.');
    if (parts.length !== 3) return 0;
    const [y, m, d] = parts.map(Number);
    return new Date(y, (m || 1) - 1, d || 1).getTime();
  }

  function sortByTime(items, order) {
    const out = items.slice();
    out.sort(function (a, b) {
      const ta = parseDate(a.date);
      const tb = parseDate(b.date);
      if (ta !== tb) return order === 'asc' ? ta - tb : tb - ta;
      return 0;
    });
    return out;
  }

  window.Youlin = {
    loadData,
    getCategoryIdFromQuery,
    getIdFromQuery,
    parseDate,
    sortByTime,
  };
})();
