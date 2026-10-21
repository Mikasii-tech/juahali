(() => {
  'use strict';
  const J = window.JH;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const view = $('#view');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = (d) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const el = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
  const TITLES = { consult: 'Consultation', today: 'Today' };
  const route = () => { const r = location.hash.replace('#/', ''); return TITLES[r] ? r : 'consult'; };
  const S = { updated: Date.now(), key: '', cur: null, busy: false, first: true, saveT: null };
  const tier = (t) => `<span class="tier t-${String(t).toLowerCase()}">${esc(t)}</span>`;

  async function api(url, opt) {
    const r = await fetch(url, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...opt });
    let d = {}; try { d = await r.json(); } catch (e) { /* no body */ }
    if (r.status === 401 || r.status === 403 && url.startsWith('/api/doctor/queue')) location.href = '/login.html';
    return { ok: r.ok, status: r.status, data: d };
  }
  function toast(msg, type) {
    const t = el('div', 'toast ' + (type || ''), msg); $('#toasts').append(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 3800);
  }

  /* ---------- Consultation screen ---------- */
  function shell() {
    view.innerHTML = '<section class="page"><div class="stats" id="stats"></div><div class="dgrid"><div id="current"></div><div><div id="hist"></div><div id="next"></div></div></div></section>';
    S.key = ''; S.first = true;
  }
  function paintStats(s) {
    const f = S.first, c = f ? 'rise' : '';
    const st = (l, n, x) => `<div class="pc stat ${c}"><div><b>${f ? `<span data-count="${n}">0</span>` : n}${x || ''}</b><span>${l}</span></div></div>`;
    $('#stats').innerHTML = st('Waiting', s.waiting) + st('Seen today', s.seenToday) + st('Average consultation', s.avgConsult, ' min') + st('Longest wait', s.longestWait, ' min');
    if (f) J.animate($('#stats'));
  }
  function paintNext(list) {
    $('#next').innerHTML = `<div class="pc"><h2>Next in line</h2>${list.length ? list.map((n) => `<div class="nxt"><span class="rk">${n.rank}</span><div><b>${esc(n.name)}</b><small>${esc(n.queueNumber)} &middot; ${esc(n.area)} &middot; ${n.minutes} min</small></div>${tier(n.tier)}</div>`).join('') : '<p class="empty">Nobody else is waiting.</p>'}</div>`;
  }
  function paintCurrent(c) {
    const box = $('#current'), h = $('#hist');
    if (!c) { box.innerHTML = '<div class="pc top-line"><h2>No patient right now</h2><p class="sub">When reception calls the next patient, they will appear here.</p></div>'; h.innerHTML = ''; return; }
    const inC = c.status === 'In Consultation';
    box.innerHTML = `<div class="pc top-line rise"><div class="pat-head"><div><small>${esc(c.status)}</small><h2>${esc(c.queueNumber)} &middot; ${esc(c.name)}</h2><p class="sub">${c.studentId ? 'Student ID ' + esc(c.studentId) : ''}</p></div>
      <div class="flags">${tier(c.tier)}${c.redFlag ? '<span class="flag">Red flag</span>' : ''}</div></div>
      <div class="kv"><div><small>Reported</small><b>${esc(c.symptom)}</b></div><div><small>Area</small><b>${esc(c.area)}</b></div><div><small>Waited</small><b>${c.waited} min</b></div></div>
      <h3>Guided answers</h3><ul class="ans">${c.answers.map((a) => `<li><span>${esc(a.q)}</span><b class="${a.a ? 'yes' : 'no'}">${a.a ? 'Yes' : 'No'}</b></li>`).join('') || '<li><span>No answers recorded.</span></li>'}</ul>
      ${inC ? `<div class="work"><h3>Consultation notes</h3><span class="timer" id="timer">00:00</span></div><textarea id="notes" maxlength="4000" placeholder="Type your notes here. They save automatically.">${esc(c.notes)}</textarea><p class="save" id="save">Notes are private to doctors.</p>
        <div class="cta2"><button class="btn btn-green" data-act="complete" type="button">Complete consultation</button></div>`
      : `<div class="cta2"><button class="btn btn-green" data-act="start" type="button">Start consultation</button></div>`}</div>`;
    h.innerHTML = `<div class="pc hist"><h2>Patient history</h2>${c.history.length ? c.history.map((x) => `<details><summary>${fmt(x.date)} &middot; ${esc(x.symptom)}</summary><small>${esc(x.area)} &middot; ${esc(x.tier)} &middot; ${esc(x.outcome)}</small>${x.notes ? `<p>${esc(x.notes)}</p>` : '<small>No notes recorded.</small>'}</details>`).join('') : '<p class="empty">First visit. No earlier history.</p>'}</div>`;
  }
  async function load() {
    if (S.busy) return; S.busy = true;
    try {
      const r = await api('/api/doctor/queue'); if (!r.ok) throw new Error('bad');
      const d = r.data;
      paintStats(d.stats); paintNext(d.next);
      const key = d.current ? d.current.id + '|' + d.current.status : 'none';
      if (key !== S.key) { S.key = key; S.cur = d.current; paintCurrent(d.current); }   // never repaint while the doctor is typing
      S.first = false; S.updated = Date.now(); $('#live').classList.remove('off');
    } catch (e) { $('#live').classList.add('off'); } finally { S.busy = false; }
  }

  view.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]'); if (!b || !S.cur) return;
    b.disabled = true;
    const body = { id: S.cur.id };
    if (b.dataset.act === 'complete') body.notes = $('#notes').value;
    const r = await api('/api/doctor/' + b.dataset.act, { method: 'POST', body: JSON.stringify(body) });
    if (r.ok) toast(b.dataset.act === 'start' ? 'Consultation started.' : 'Consultation completed.', 'call'); else toast(r.data.message || 'Could not do that.');
    S.busy = false; S.key = ''; load();
  });
  view.addEventListener('input', (e) => {
    if (e.target.id !== 'notes' || !S.cur) return;
    $('#save').textContent = 'Typing...'; clearTimeout(S.saveT);
    S.saveT = setTimeout(async () => {
      const r = await api('/api/doctor/notes', { method: 'PUT', body: JSON.stringify({ id: S.cur.id, notes: e.target.value }) });
      const s = $('#save'); if (s) s.textContent = r.ok ? 'Saved at ' + time(r.data.savedAt) : 'Could not save. Will retry when you type again.';
    }, 1200);
  });
  setInterval(() => {
    const t = $('#timer');
    if (t && S.cur && S.cur.consultStartAt) { const s = Math.max(0, Math.floor((Date.now() - new Date(S.cur.consultStartAt)) / 1000)); t.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
  }, 1000);

  /* ---------- Today ---------- */
  async function today() {
    view.innerHTML = '<section class="page"><div class="sk h3"></div></section>';
    const r = await api('/api/doctor/today'); if (!r.ok) { view.innerHTML = '<section class="page"><div class="pc"><h2>Could not load.</h2></div></section>'; return; }
    const rows = r.data.rows.map((x, i) => `<div class="visit" data-i="${Math.min(i, 12)}"><div><b>${esc(x.queueNumber)} &middot; ${esc(x.name)}</b><small>${esc(x.area)} &middot; ${x.at ? time(x.at) : ''}${x.minutes != null ? ' &middot; ' + x.minutes + ' min' : ''}</small></div><div>${tier(x.tier)} <span class="badge ${x.outcome === 'Completed' ? 'ok' : ''}">${esc(x.outcome)}</span></div></div>`).join('');
    view.innerHTML = `<section class="page"><div class="pc">${rows || '<p class="empty">No finished visits yet today.</p>'}</div></section>`;
    J.animate(view);
  }

  /* ---------- Shell ---------- */
  function show() {
    const r = route();
    $('#ptitle').textContent = TITLES[r];
    $$('#nav a').forEach((a) => { if (a.dataset.r === r) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    if (r === 'consult') { shell(); load(); } else today();
    window.scrollTo({ top: 0 });
  }
  async function logout() { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); location.href = '/login.html'; }
  $('#logout').addEventListener('click', logout);
  $('#theme').addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('jh-theme', next); } catch (e) { /* storage unavailable */ }
  });
  window.addEventListener('hashchange', show);
  const refresh = () => { if (route() === 'consult') load(); };
  setInterval(refresh, 15000);
  if (window.io) { try { io().on('queue:changed', refresh); } catch (e) { /* polling still works */ } }
  setInterval(() => {
    const s = Math.round((Date.now() - S.updated) / 1000);
    $('#livetxt').textContent = $('#live').classList.contains('off') ? 'Reconnecting...' : 'Live \u00B7 ' + (s < 5 ? 'just now' : s + 's ago');
  }, 1000);
  api('/api/auth/me').then((r) => { if (!r.ok) return; const n = r.data.user.fullName.trim(); $('#sname').textContent = n; $('#savatar').textContent = n[0].toUpperCase(); $('#chip').textContent = n[0].toUpperCase(); });
  show();
})();
