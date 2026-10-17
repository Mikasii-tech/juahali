// Tiny SVG chart helpers (no libraries): bar, donut, spark, plus animate() and countUp()
(() => {
  'use strict';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COLORS = ['#C4232F', '#17845C', '#E08A00', '#7A3E9D', '#2F6FD0', '#8C6A6D'];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const raf2 = (fn) => requestAnimationFrame(() => requestAnimationFrame(fn));

  function bar(data, { h = 210, label = 'Bar chart' } = {}) {
    const W = 520, pl = 28, pr = 8, pt = 24, pb = 28, ph = h - pt - pb;
    const max = Math.max(1, ...data.map((d) => d.value)), step = Math.max(1, Math.ceil(max / 3)), top = step * 3;
    const bw = (W - pl - pr) / data.length;
    let g = '';
    for (let i = 0; i <= 3; i++) { const y = pt + ph - (ph * i) / 3; g += `<line x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}" class="grid"/><text x="${pl - 6}" y="${y + 4}" text-anchor="end">${step * i}</text>`; }
    const bars = data.map((d, i) => {
      const bh = d.value ? Math.max(4, (d.value / top) * ph) : 0, x = pl + i * bw + bw * 0.2, y = pt + ph - bh;
      return `<g><rect class="bar" data-i="${i}" x="${x}" y="${y}" width="${bw * 0.6}" height="${bh}" rx="6"><title>${esc(d.label)}: ${d.value}</title></rect>` +
        (d.value ? `<text x="${x + bw * 0.3}" y="${y - 6}" text-anchor="middle" class="val">${d.value}</text>` : '') +
        `<text x="${x + bw * 0.3}" y="${h - 8}" text-anchor="middle">${esc(d.label)}</text></g>`;
    }).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${h}" role="img" aria-label="${esc(label)}">${g}${bars}</svg>`;
  }

  function donut(items, { centerLabel = 'total' } = {}) {
    const total = items.reduce((a, b) => a + b.value, 0);
    if (!total) return '<p class="empty">No data yet.</p>';
    const r = 52, C = 2 * Math.PI * r; let acc = 0;
    const segs = items.map((it, i) => {
      const len = (it.value / total) * C, dash = Math.max(0.5, len - (items.length > 1 ? 3 : 0));
      const s = `<circle class="seg" cx="70" cy="70" r="${r}" fill="none" stroke="${COLORS[i % COLORS.length]}" stroke-width="18" data-d="${dash} ${C}" stroke-dashoffset="${-acc}" transform="rotate(-90 70 70)"><title>${esc(it.label)}: ${it.value}</title></circle>`;
      acc += len; return s;
    }).join('');
    const legend = items.map((it, i) => `<li><i class="sw" data-c="${i % COLORS.length}"></i><span>${esc(it.label)}</span><b>${it.value}</b></li>`).join('');
    return `<div class="donut"><svg viewBox="0 0 140 140" role="img" aria-label="Breakdown chart"><circle cx="70" cy="70" r="${r}" fill="none" class="donut-bg" stroke-width="18"/>${segs}<text x="70" y="68" text-anchor="middle" class="dnum">${total}</text><text x="70" y="86" text-anchor="middle" class="dlab">${esc(centerLabel)}</text></svg><ul class="legend">${legend}</ul></div>`;
  }

  function spark(data, { h = 170, label = 'Trend chart' } = {}) {
    const W = 520, p = 22, base = h - 30, ph = base - 18, max = Math.max(1, ...data.map((d) => d.value));
    const xs = data.map((_, i) => p + (i * (W - 2 * p)) / Math.max(1, data.length - 1));
    const ys = data.map((d) => base - (d.value / max) * ph);
    let line = `M ${xs[0]} ${ys[0]}`;
    for (let i = 1; i < xs.length; i++) { const m = (xs[i - 1] + xs[i]) / 2; line += ` C ${m} ${ys[i - 1]}, ${m} ${ys[i]}, ${xs[i]} ${ys[i]}`; }
    const area = `${line} L ${xs[xs.length - 1]} ${base} L ${xs[0]} ${base} Z`;
    const dots = data.map((d, i) => `<circle class="pt" cx="${xs[i]}" cy="${ys[i]}" r="${i === data.length - 1 ? 5 : 3.5}"><title>${esc(d.label)}: ${d.value}</title></circle>`).join('');
    const labs = data.map((d, i) => `<text x="${xs[i]}" y="${h - 8}" text-anchor="middle">${esc(d.label)}</text>`).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${h}" role="img" aria-label="${esc(label)}"><defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C4232F" stop-opacity=".28"/><stop offset="1" stop-color="#C4232F" stop-opacity="0"/></linearGradient></defs><line x1="${p}" x2="${W - p}" y1="${base}" y2="${base}" class="grid"/><path d="${area}" fill="url(#sg)" class="spark-area"/><path d="${line}" class="spark-line" fill="none"/>${dots}${labs}</svg>`;
  }

  function countUp(el) {
    const to = Number(el.dataset.count);
    if (reduce || !isFinite(to)) { el.textContent = isFinite(to) ? to : ''; return; }
    const t0 = performance.now(), dur = 900;
    const f = (t) => { const p = Math.min(1, (t - t0) / dur); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  }

  // Call after inserting chart or card HTML: staggers, draws and counts everything inside root
  function animate(root) {
    root.querySelectorAll('[data-i]').forEach((n) => n.style.setProperty('--i', n.dataset.i));
    root.querySelectorAll('.sw').forEach((n) => { n.style.background = COLORS[Number(n.dataset.c)]; });
    root.querySelectorAll('.seg').forEach((c) => {
      const d = c.dataset.d;
      if (reduce) { c.style.strokeDasharray = d; return; }
      c.style.strokeDasharray = '0 1000'; raf2(() => { c.style.strokeDasharray = d; });
    });
    root.querySelectorAll('.ring-fg').forEach((c) => {
      const L = 2 * Math.PI * 52, fin = L * (1 - Number(c.dataset.p));
      c.style.strokeDasharray = L;
      if (reduce) { c.style.strokeDashoffset = fin; return; }
      c.style.strokeDashoffset = L; raf2(() => { c.style.strokeDashoffset = fin; });
    });
    root.querySelectorAll('.spark-line').forEach((p) => {
      if (reduce) return;
      const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; raf2(() => { p.style.strokeDashoffset = 0; });
    });
    root.querySelectorAll('[data-count]').forEach(countUp);
  }

  window.JH = { bar, donut, spark, animate, countUp };
})();
