(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ForwardProfile = api;
})(globalThis, function () {
  'use strict';
  const limits = { role: { max: 80, unit: 'characters' }, summary: { max: 100, unit: 'words' },
    mission: { max: 50, unit: 'words' }, values: { max: 50, unit: 'words' },
    wellbeing: { max: 75, unit: 'words' }, support: { max: 75, unit: 'words' },
    community: { max: 75, unit: 'words' }, skills: { max: 10, unit: 'skills' } };
  function count(value, unit = 'words') {
    const text = String(value || '').trim();
    if (unit === 'characters') return Array.from(String(value || '')).length;
    if (!text) return 0;
    return (unit === 'skills' ? text.split(',') : text.split(/\s+/u)).filter(part => part.trim()).length;
  }
  function normalizeFeaturedRoles(value) {
    const roles = Array.isArray(value) ? value : [];
    return Array.from({ length: 3 }, (_, index) => Object.fromEntries(['title', 'dates', 'summary'].map(key =>
      [key, typeof roles[index]?.[key] === 'string' ? roles[index][key].slice(0, 150000) : ''])));
  }
  function violations(fields, roles = []) {
    const errors = Object.entries(limits).filter(([key, rule]) => count(fields[key], rule.unit) > rule.max)
      .map(([key, rule]) => ({ key, message: `Keep this to ${rule.max} ${rule.unit}. Your full draft is still saved.` }));
    normalizeFeaturedRoles(roles).forEach((role, index) => {
      if (count(role.summary) > 100) errors.push({ key: `featured-${index}-summary`, message: 'Keep this role highlight to 100 words. Your full résumé is unchanged.' });
      if ((role.summary.trim() || role.dates.trim()) && !role.title.trim()) errors.push({ key: `featured-${index}-title`, message: 'Add a role and organization for this highlight, or clear its details.' });
    });
    return errors;
  }
  // Suggestions are editable starting points, never a ranking or an automatic choice.
  function suggestRoles(text) {
    const lines = String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const month = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
    const period = `(?:(?:${month}\\.?\\s+)|(?:\\d{1,2}[/.-]))?(?:19|20)\\d{2}`;
    const dates = new RegExp(`\\b${period}\\s*(?:[-–—]|\\bto\\b)\\s*(?:${period}|present|current|now)\\b`, 'i');
    const bullet = /^[•●▪*\-–]\s*/;
    const starts = [];
    lines.forEach((line, index) => {
      if (!dates.test(line) || bullet.test(line)) return;
      let start = index;
      // A date-only line usually follows a job title and sometimes an employer.
      if (!line.slice(0, line.match(dates).index).replace(/[|,\s]/g, '')) {
        const previous = lines[index - 1];
        if (previous && !bullet.test(previous) && !dates.test(previous) && previous.length < 130) start--;
        const earlier = lines[start - 1];
        if (earlier && !bullet.test(earlier) && !dates.test(earlier) && earlier.length < 90 && !/[.!?]$/.test(earlier) &&
          !/^(?:experience|work history|employment|awards|projects)$/i.test(earlier) && (starts.length === 0 || start - 1 > starts.at(-1).date + 1)) start--;
      }
      starts.push({ start, date: index });
    });
    return starts.map((entry, index) => {
      const dateLine = lines[entry.date];
      const match = dateLine.match(dates);
      const inlineTitle = dateLine.slice(0, match.index).replace(/[|,\s]+$/, '').trim();
      const title = lines.slice(entry.start, entry.date).concat(inlineTitle ? [inlineTitle] : []).join(' · ');
      return { title: title || 'Review this role title', dates: match[0],
        summary: lines.slice(entry.date + 1, starts[index + 1]?.start ?? lines.length).join('\n') };
    }).filter(role => role.title).slice(0, 60);
  }
  return { limits, count, normalizeFeaturedRoles, violations, suggestRoles };
});
