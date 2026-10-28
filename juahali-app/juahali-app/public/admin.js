(() => {
  'use strict';
  const J = window.JH;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const view = $('#view');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const el = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
  const r1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
  const TITLES = { reports: 'Reports', users: 'Users', ai: 'AI model' };
  const route = () => { const r = location.hash.replace('#/', ''); return TITLES[r] ? r : 'reports'; };
  const S = { days: 7, tiers: [], q: '', role: '' };
  const sk = () => '<section class="page"><div class="sk h1"></div><div class="sk h3"></div></section>';
  const tierBadge = (t) => `<span class="tier t-${String(t).toLowerCase()}">${esc(t)}</span>`;

  async function api(url, opt) {
    const r = await fetch(url, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...opt });
    let d = {}; try { d = await r.json(); } catch (e) { /* no body */ }
    if (r.status === 401) location.href = '/login.html';
    return { ok: r.ok, status: r.status, data: d };
  }
  function toast(msg, type) {
    const t = el('div', 'toast ' + (type || ''), msg); $('#toasts').append(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 3800);
  }

  /* ---------- Reports ---------- */
  async function reports() {
    view.innerHTML = sk();
    const r = await api('/api/admin/reports?days=' + S.days);
    if (!r.ok) { view.innerHTML = '<section class="page"><div class="pc"><h2>Could not load the reports.</h2></div></section>'; return; }
    const d = r.data, t = d.totals; S.tiers = d.waitByTier;
    const stat = (l, n, x, i) => `<div class="pc stat rise" data-i="${i}"><div><b><span data-count="${n}">0</span>${x || ''}</b><span>${l}</span></div></div>`;
    const hours = d.byHour.filter((h) => h.hour >= 6 && h.hour <= 20).map((h) => ({ label: String(h.hour), value: h.count }));
    const max = Math.max(1, ...d.timeSaved.flatMap((x) => [x.actual, x.fcfs]));
    const cmp = d.timeSaved.map((x) => !x.n ? '' : `<div class="cmp-row"><div>${tierBadge(x.tier)}<br><small>${x.n} patients</small></div>
      <div class="bars"><div class="hb f"><i data-w="${(x.fcfs / max) * 100}"></i></div><div class="hb a"><i data-w="${(x.actual / max) * 100}"></i></div></div>
      <div><small>FCFS ${r1(x.fcfs)} min<br>Actual ${r1(x.actual)} min</small><br><span class="${x.saved >= 0 ? 'good' : 'bad'}">${x.saved >= 0 ? 'Saved ' : 'Waited '}${r1(Math.abs(x.saved))} min</span></div></div>`).join('');
    const urgent = d.timeSaved.filter((x) => (x.tier === 'Critical' || x.tier === 'Severe') && x.n), un = urgent.reduce((a, x) => a + x.n, 0);
    const usaved = un ? urgent.reduce((a, x) => a + x.saved * x.n, 0) / un : 0;
    const staff = d.staff.map((s) => `<tr><td>${esc(s.name)}</td><td>${esc(s.role)}</td><td class="num">${s.calls}</td><td class="num">${s.noShows}</td><td class="num">${s.started}</td><td class="num">${s.completed}</td></tr>`).join('');
    view.innerHTML = `<section class="page">
      <div class="tools rise">${[7, 30, 90].map((n) => `<button class="fchip" data-days="${n}" aria-pressed="${n === S.days}">Last ${n} days</button>`).join('')}<button id="csv" class="btn btn-line" type="button">Download CSV</button></div>
      <div class="stats">${stat('Check-ins', t.checkIns, '', 1)}${stat('Average wait', Math.round(t.avgWait), ' min', 2)}${stat('Average consultation', Math.round(t.avgConsult), ' min', 3)}${stat('No-show rate', t.noShowRate, '%', 4)}</div>
      <div class="g2"><div class="pc rise" data-i="5"><h2>Patient flow by hour</h2><p class="sub">Check-ins by hour of the day.</p>${J.bar(hours, { label: 'Check-ins by hour' })}</div>
        <div class="pc rise" data-i="6"><h2>Outcomes</h2>${J.donut([{ label: 'Completed', value: t.completed }, { label: 'No-show', value: t.noShows }].filter((x) => x.value), { centerLabel: 'visits' })}</div></div>
      <div class="pc rise" data-i="7"><h2>Daily patient flow</h2>${J.spark(d.daily.map((x) => ({ label: x.label, value: x.count })), { label: 'Check-ins per day' })}</div>
      <div class="pc rise" data-i="8"><h2>Waiting time by urgency tier</h2><div class="scroll"><table class="tbl"><thead><tr><th>Tier</th><th class="num">Patients</th><th class="num">Average</th><th class="num">Median</th><th class="num">Longest</th></tr></thead><tbody>
        ${d.waitByTier.map((x) => `<tr><td>${tierBadge(x.tier)}</td><td class="num">${x.n}</td><td class="num">${r1(x.avg)} min</td><td class="num">${r1(x.median)} min</td><td class="num">${r1(x.max)} min</td></tr>`).join('')}</tbody></table></div></div>
      <div class="pc rise" data-i="9"><h2>Time saved by urgency ranking</h2>
        <p class="sub">The same call times are replayed in arrival order (first-come-first-served) and compared with what actually happened.</p>
        ${un ? `<div class="hero2">Severe and Critical patients waited <b>${r1(Math.abs(usaved))} minutes ${usaved >= 0 ? 'less' : 'more'}</b> on average than they would under first-come-first-served.</div>` : '<p class="empty">Not enough served patients yet.</p>'}
        <div class="legend2"><span><i class="f2"></i>First-come-first-served</span><span><i class="a2"></i>Actual</span></div><div class="cmp">${cmp}</div></div>
      <div class="pc rise" data-i="10"><h2>Staff workload</h2><div class="scroll"><table class="tbl"><thead><tr><th>Name</th><th>Role</th><th class="num">Called</th><th class="num">No-shows</th><th class="num">Started</th><th class="num">Completed</th></tr></thead><tbody>${staff || '<tr><td colspan="6" class="empty">No staff activity in this period.</td></tr>'}</tbody></table></div></div></section>`;
    J.animate(view);
    $$('.hb i', view).forEach((i) => requestAnimationFrame(() => requestAnimationFrame(() => i.style.setProperty('--w', i.dataset.w + '%'))));
    $$('.legend2 .f2').forEach((i) => { i.style.background = '#9B8486'; }); $$('.legend2 .a2').forEach((i) => { i.style.background = '#C4232F'; });
  }
  view.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-days]'); if (chip) { S.days = Number(chip.dataset.days); reports(); return; }
    if (e.target.id === 'csv') {
      const rows = [['Tier', 'Patients', 'Average wait (min)', 'Median wait (min)', 'Longest wait (min)'], ...S.tiers.map((x) => [x.tier, x.n, r1(x.avg), r1(x.median), r1(x.max)])];
      const csv = rows.map((x) => x.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
      const a = el('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'juahali-wait-times.csv'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000); toast('Report downloaded.');
    }
  });

  /* ---------- Users ---------- */
  function secret(name, pw) {
    const box = $('#secret'); if (!box) return;
    box.innerHTML = `<div class="secret"><div><b>Temporary password for ${esc(name)}</b><br><small>Shown only once. Give it to the person and ask them to keep it private.</small></div><code>${esc(pw)}</code><button class="btn btn-line mini" id="copy" type="button">Copy</button></div>`;
    $('#copy').addEventListener('click', () => { navigator.clipboard.writeText(pw).then(() => toast('Copied.')).catch(() => toast('Select and copy it manually.')); });
  }
  async function users() {
    view.innerHTML = sk();
    const r = await api('/api/admin/users?q=' + encodeURIComponent(S.q) + '&role=' + encodeURIComponent(S.role));
    if (!r.ok) { view.innerHTML = '<section class="page"><div class="pc"><h2>Could not load users.</h2></div></section>'; return; }
    const c = r.data.counts;
    view.innerHTML = `<section class="page">
      <div class="stats"><div class="pc stat rise"><div><b>${c.patient || 0}</b><span>Patients</span></div></div><div class="pc stat rise" data-i="1"><div><b>${c.receptionist || 0}</b><span>Receptionists</span></div></div><div class="pc stat rise" data-i="2"><div><b>${c.doctor || 0}</b><span>Doctors</span></div></div><div class="pc stat rise" data-i="3"><div><b>${c.admin || 0}</b><span>Admins</span></div></div></div>
      <div id="secret"></div>
      <form id="add" class="pc rise" data-i="4" novalidate><h2>Add a staff member</h2><div class="addform mt">
        <div><label for="an">Full name</label><input id="an" autocomplete="off"></div><div><label for="ae">Email</label><input id="ae" type="email" autocomplete="off"></div>
        <div><label for="ar">Role</label><select id="ar"><option value="receptionist">Receptionist</option><option value="doctor">Doctor</option><option value="admin">Admin</option></select></div>
        <button class="btn btn-green" type="submit">Create account</button></div><div id="am" role="status"></div></form>
      <div class="tools rise" data-i="5"><input id="uq" class="search" type="search" placeholder="Search by name or email" aria-label="Search users" value="${esc(S.q)}">
        ${['', 'patient', 'receptionist', 'doctor', 'admin'].map((x) => `<button class="fchip" data-role="${x}" aria-pressed="${S.role === x}">${x ? x[0].toUpperCase() + x.slice(1) : 'All'}</button>`).join('')}</div>
      <div class="pc rise" data-i="6">${r.data.users.map((u) => `<div class="urow"><div><b>${esc(u.fullName)}</b><br><small class="hm">${u.studentId ? 'ID ' + esc(u.studentId) : ''}</small></div><div class="hm">${esc(u.email)}</div>
        <span class="badge">${esc(u.role)}</span><span class="badge ${u.isActive ? 'ok' : ''}">${u.isActive ? 'Active' : 'Inactive'}</span>
        <div class="acts"><button class="btn btn-line mini" data-reset="${esc(u.id)}" data-name="${esc(u.fullName)}" type="button">Reset password</button><button class="btn btn-line mini" data-toggle="${esc(u.id)}" data-on="${u.isActive ? '0' : '1'}" type="button">${u.isActive ? 'Deactivate' : 'Reactivate'}</button></div></div>`).join('') || '<p class="empty">No users found.</p>'}</div></section>`;
    J.animate(view);
    let timer; $('#uq').addEventListener('input', (e) => { clearTimeout(timer); timer = setTimeout(() => { S.q = e.target.value.trim(); users(); }, 400); });
    $$('[data-role]', view).forEach((b) => b.addEventListener('click', () => { S.role = b.dataset.role; users(); }));
    $$('[data-reset]', view).forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Reset the password for ' + b.dataset.name + '?')) return;
      const x = await api('/api/admin/users/' + b.dataset.reset + '/reset', { method: 'POST' });
      if (x.ok) { secret(b.dataset.name, x.data.tempPassword); window.scrollTo({ top: 0, behavior: 'smooth' }); } else toast(x.data.message || 'Could not reset.');
    }));
    $$('[data-toggle]', view).forEach((b) => b.addEventListener('click', async () => {
      const x = await api('/api/admin/users/' + b.dataset.toggle, { method: 'PATCH', body: JSON.stringify({ isActive: b.dataset.on === '1' }) });
      if (x.ok) { toast('Account updated.'); users(); } else toast(x.data.message || 'Could not update.');
    }));
    $('#add').addEventListener('submit', async (e) => {
      e.preventDefault();
      const x = await api('/api/admin/staff', { method: 'POST', body: JSON.stringify({ fullName: $('#an').value, email: $('#ae').value, role: $('#ar').value }) });
      const m = $('#am'); if (x.ok) { await users(); secret(x.data.user.fullName, x.data.tempPassword); } else { m.className = 'err-msg'; m.textContent = x.data.message || 'Could not create the account.'; }
    });
  }


  /* ---------- AI model (wait-time predictor) ---------- */
  const nice = (n) => n.startsWith('tier:') ? n.slice(5) + ' cases (compared with Mild)' : n.startsWith('area:') ? n.slice(5) + ' (compared with skin, eyes and other)' : n === 'afternoon' ? 'Seen after 13:00' : 'Later in the day (per 6 hours)';
  async function ai() {
    view.innerHTML = sk();
    const r = await api('/api/admin/ai/wait');
    if (!r.ok) { view.innerHTML = '<section class="page"><div class="pc"><h2>Could not load the AI page.</h2></div></section>'; return; }
    const d = r.data, m = d.model, x = m && m.metrics;
    const status = !m ? 'Not trained' : m.enabled ? 'On' : 'Off';
    const max = x ? Math.max(x.maeModel, x.maeBaseline, 0.01) : 1;
    const coef = m ? m.coefficients.filter((c) => c.name !== 'bias') : [];
    const cmax = Math.max(0.01, ...coef.map((c) => Math.abs(c.weight)));
    view.innerHTML = `<section class="page">
      <div class="pc rise"><div class="pat-head"><div><small>Wait-time predictor</small><h2>Learns how long each consultation takes</h2><p class="sub">It predicts the length of each patient ahead of you from their urgency tier, area and time of day, then adds them up. It only changes the <b>wait estimate</b>. It never changes who is called first.</p></div><span class="badge ${m && m.enabled ? 'ok' : ''}">${status}</span></div>
        <div class="cta2"><button id="train" class="btn btn-green" type="button">Train on current data</button>${m ? `<button id="tog" class="btn btn-line" type="button">${m.enabled ? 'Switch AI estimates off' : 'Switch AI estimates on'}</button>` : ''}</div>
        <p class="save">${d.available} finished consultations available (at least ${d.min} needed). ${d.synthetic ? `<b>${d.synthetic} of them are synthetic demo data.</b>` : 'All are real.'}</p></div>
      ${m ? `<div class="pc rise" data-i="1"><h2>How accurate is it?</h2>
        <p class="sub">Trained on the earlier ${m.nTrain} consultations, then tested on the latest ${m.nTest} that it had never seen. Lower error is better.</p>
        ${m.syntheticShare > 0.2 ? `<div class="msg">${Math.round(m.syntheticShare * 100)}% of the data is synthetic. These results show that the method works, not how accurate it is in the real clinic.</div>` : ''}
        <div class="hero2">AI error is <b>${Math.abs(Math.round(x.improvement * 100))}% ${x.improvement >= 0 ? 'lower' : 'higher'}</b> than the current rolling average.</div>
        <div class="cmp"><div class="cmp-row"><div><b>AI model</b></div><div class="bars"><div class="hb a"><i data-w="${(x.maeModel / max) * 100}"></i></div></div><div><small>Average error</small><br><b>${r1(x.maeModel)} min</b></div></div>
        <div class="cmp-row"><div><b>Rolling average</b></div><div class="bars"><div class="hb f"><i data-w="${(x.maeBaseline / max) * 100}"></i></div></div><div><small>Average error</small><br><b>${r1(x.maeBaseline)} min</b></div></div></div>
        <p class="save">Trained ${new Date(m.trainedAt).toLocaleString('en-GB')}. Average error means how many minutes off the prediction is, on average.</p></div>
        <div class="pc rise" data-i="2"><h2>What it learned</h2><p class="sub">Extra minutes the model adds to a consultation. Nothing is hidden: these are all of its numbers.</p>
        <div class="cmp">${coef.map((c) => `<div class="cmp-row"><div class="sub">${esc(nice(c.name))}</div><div class="bars"><div class="hb ${c.weight >= 0 ? 'a' : 'f'}"><i data-w="${(Math.abs(c.weight) / cmax) * 100}"></i></div></div><div><b class="${c.weight >= 0 ? 'bad' : 'good'}">${c.weight >= 0 ? '+' : '-'}${r1(Math.abs(c.weight))} min</b></div></div>`).join('')}</div></div>` : ''}
      <div class="pc rise" data-i="3"><h2>Safety rules</h2><ul class="tips"><li>The AI only affects the wait estimate shown to patients. Who is called next is decided by the urgency engine.</li><li>Predictions are always kept between 2 and 60 minutes.</li><li>If the model is off or missing, the system uses the rolling average, as before.</li><li>Patients see "AI-assisted estimate" next to the figure, so nothing is hidden.</li></ul></div></section>`;
    J.animate(view);
    $$('.hb i', view).forEach((i) => requestAnimationFrame(() => requestAnimationFrame(() => i.style.setProperty('--w', i.dataset.w + '%'))));
    $('#train').addEventListener('click', async (e) => {
      e.target.disabled = true; e.target.textContent = 'Training...';
      const t = await api('/api/admin/ai/wait/train', { method: 'POST' });
      if (t.ok) toast('Model trained.', 'call'); else toast(t.data.message || 'Could not train.');
      ai();
    });
    const tog = $('#tog'); if (tog) tog.addEventListener('click', async () => {
      const t = await api('/api/admin/ai/wait/enable', { method: 'POST', body: JSON.stringify({ enabled: !m.enabled }) });
      if (t.ok) toast(t.data.enabled ? 'AI estimates are on.' : 'AI estimates are off.', 'call'); else toast(t.data.message || 'Could not change it.');
      ai();
    });
  }

  /* ---------- Shell ---------- */
  function show() {
    const r = route(); $('#ptitle').textContent = TITLES[r];
    $$('#nav a').forEach((a) => { if (a.dataset.r === r) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    Promise.resolve(r === 'reports' ? reports() : r === 'ai' ? ai() : users()).catch(() => { view.innerHTML = '<section class="page"><div class="pc"><h2>Something went wrong.</h2></div></section>'; });
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
  api('/api/auth/me').then((r) => { if (!r.ok) return; const n = r.data.user.fullName.trim(); $('#sname').textContent = n; $('#savatar').textContent = n[0].toUpperCase(); $('#chip').textContent = n[0].toUpperCase(); });
  show();
})();
