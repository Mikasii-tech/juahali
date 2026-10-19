(() => {
  "use strict";
  const J = window.JH;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const view = $("#view");
  const esc = (s) =>
    String(s == null ? "" : s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const fmt = (d) =>
    new Date(d).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  const el = (tag, cls, txt) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  };
  const I = (d) =>
    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
  const ICON = {
    list: "M9 5h6M9 3h6v4H9zM6 5H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-1",
    cal: "M8 3v4M16 3v4M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z",
    clock: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
    heart:
      "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z",
  };
  const S = {
    me: null,
    active: null,
    cats: null,
    updated: Date.now(),
    key: "",
  };
  const topCats = (c) => {
    const t = c.slice(0, 5).map((x) => ({ label: x.label, value: x.count })),
      rest = c.slice(5).reduce((a, x) => a + x.count, 0);
    return rest ? [...t, { label: "Other", value: rest }] : t;
  };
  const TITLES = {
    home: "Dashboard",
    checkin: "Check in",
    visits: "My visits",
    insights: "Insights",
    help: "Help",
    profile: "Profile",
  };
  const route = () => {
    const r = location.hash.replace("#/", "");
    return TITLES[r] ? r : "home";
  };

  async function api(url, opt) {
    const r = await fetch(url, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      ...opt,
    });
    let d = {};
    try {
      d = await r.json();
    } catch (e) {
      /* no body */
    }
    if (r.status === 401 || r.status === 403) location.href = "/login.html";
    return { ok: r.ok, status: r.status, data: d };
  }
  function toast(msg, type) {
    const t = el("div", "toast " + (type || ""), msg);
    $("#toasts").append(t);
    setTimeout(() => {
      t.classList.add("out");
      setTimeout(() => t.remove(), 300);
    }, 3800);
  }
  const sk = () =>
    '<section class="page"><div class="sk h1"></div><div class="sk h2"></div><div class="sk h3"></div></section>';
  const oops = () => {
    view.innerHTML =
      '<section class="page"><div class="pc"><h2>Something went wrong</h2><p class="sub">Please refresh the page and try again.</p></div></section>';
  };

  /* ---------- Shell: avatar, live status, called banner ---------- */
  function shell() {
    const n = S.me ? S.me.fullName.trim() : "",
      ini = n ? n[0].toUpperCase() : "";
    $("#chip").textContent = ini;
    $("#savatar").textContent = ini;
    $("#sname").textContent = n || "Patient";
    $("#smail").textContent = S.me ? S.me.email : "";
    $('[data-r="checkin"]').classList.toggle("has-live", !!S.active);
  }
  function setActive(e) {
    const prev = S.active;
    S.active = e;
    shell();
    const b = $("#called");
    if (e && e.status === "Called") {
      b.textContent =
        "Your turn, " + e.queueNumber + ". Please go to the desk now.";
      b.hidden = false;
      document.title = "Your turn! | JUAHALI";
      if (!prev || prev.status !== "Called") {
        toast("It is your turn. Please go to the desk.", "call");
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
    } else {
      b.hidden = true;
      document.title = "JUAHALI | Patient";
    }
  }

  /* ---------- Queue card ---------- */
  const STEPS = ["Checked in", "Waiting", "Called", "In consultation"];
  const IDX = { Waiting: 1, Called: 2, "In Consultation": 3 };
  const ring = (p, inner) =>
    `<div class="ringwrap"><svg class="ring" viewBox="0 0 120 120" aria-hidden="true"><circle class="ring-bg" cx="60" cy="60" r="52"/><circle class="ring-fg" cx="60" cy="60" r="52" data-p="${p}"/></svg><div class="ring-in">${inner}</div></div>`;
  function qcard(e) {
    const now = IDX[e.status] || 1;
    const prog =
      e.status === "Waiting"
        ? Math.min(
            0.8,
            0.1 + (0.7 * (e.queueSize - e.position + 1)) / (e.queueSize || 1),
          )
        : e.status === "Called"
          ? 0.9
          : 1;
    const centre =
      e.status === "Waiting"
        ? `<small>Position</small><b data-count="${e.position}">0</b>`
        : e.status === "Called"
          ? "<small>Your turn</small><b>Go</b>"
          : "<small>Status</small><b>In</b>";
    const line =
      e.status === "Waiting"
        ? `${e.ahead === 0 ? "You are next." : e.ahead + (e.ahead === 1 ? " patient is" : " patients are") + " ahead of you."} Estimated wait about <b>${e.estWaitMin} min</b>.`
        : e.status === "Called"
          ? "Please go to the desk now."
          : "You are with the doctor.";
    const steps = STEPS.map(
      (s, i) =>
        `<li class="${i < now ? "done" : i === now ? "now" : ""}"><i>${i < now ? "\u2713" : i + 1}</i>${s}</li>`,
    ).join("");
    return `<div class="pc top-line qcard">${ring(prog, centre)}<div>
      <div class="qtop"><div><small>Your queue number</small><div class="qn">${esc(e.queueNumber)}</div></div><span class="status s-${e.status.toLowerCase().replace(/ /g, "-")}"><i></i>${esc(e.status)}</span></div>
      <p class="qline">${line}</p><ol class="tl">${steps}</ol><p class="sub mt">${esc(e.symptom)} &middot; checked in ${new Date(e.checkInAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</p></div></div>`;
  }
  const slotHTML = () =>
    S.active
      ? qcard(S.active)
      : `<div class="pc cta"><div><h2>Not feeling well?</h2><p class="sub">Check in from your phone and watch your place in line, live.</p><div class="mt"><a class="btn btn-green" href="#/checkin">Check in now</a></div></div><svg class="pulse-line" viewBox="0 0 120 44" aria-hidden="true"><path d="M2 24h26l8-18 12 34 10-24 8 8h52"/></svg></div>`;
  function paintSlot(force) {
    const slot = $("#slot");
    if (!slot) return;
    const key = JSON.stringify(S.active);
    if (!force && key === S.key) return;
    S.key = key;
    slot.innerHTML = slotHTML();
    J.animate(slot);
  }
  function updateSnap(c) {
    [
      ["#c-wait", c.waiting],
      ["#c-cons", c.inConsultation],
      ["#c-done", c.completedToday],
      ["#c-est", c.estWaitNewMin],
    ].forEach(([s, v]) => {
      const n = $(s);
      if (n) n.textContent = v;
    });
  }

  /* ---------- Home ---------- */
  async function home() {
    view.innerHTML = sk();
    const [s, i] = await Promise.all([
      api("/api/patient/summary"),
      api("/api/patient/insights"),
    ]);
    if (!s.ok || !i.ok) return oops();
    S.me = s.data.user;
    setActive(s.data.entry);
    const d = i.data,
      c = d.clinic,
      h = new Date().getHours();
    const greet =
      h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
    const month = d.monthly[d.monthly.length - 1].count;
    view.innerHTML = `<section class="page">
      <div class="hero rise"><h1 class="big">${greet}, ${esc(S.me.fullName.split(" ")[0])}</h1><p>${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}. Here is what is happening at the clinic right now.</p>
        <div class="chips"><div class="chip"><span>Waiting now</span><b id="c-wait" data-count="${c.waiting}">0</b></div><div class="chip"><span>With the doctor</span><b id="c-cons" data-count="${c.inConsultation}">0</b></div><div class="chip"><span>Seen today</span><b id="c-done" data-count="${c.completedToday}">0</b></div><div class="chip"><span>Wait if you check in as a minor case</span><b><span id="c-est" data-count="${c.estWaitNewMin}">0</span> min</b></div></div></div>
      <div id="slot" class="rise" data-i="1"></div>
      <div class="stats">
        <div class="pc stat lift rise" data-i="2"><span class="ico">${I(ICON.list)}</span><div><b data-count="${d.total}">0</b><span>Check-ins</span></div></div>
        <div class="pc stat lift rise" data-i="3"><span class="ico">${I(ICON.cal)}</span><div><b data-count="${month}">0</b><span>This month</span></div></div>
        <div class="pc stat lift rise" data-i="4"><span class="ico">${I(ICON.clock)}</span><div><b>${s.data.lastVisit ? fmt(s.data.lastVisit) : "None yet"}</b><span>Last visit</span></div></div>
        <div class="pc stat lift rise" data-i="5"><span class="ico">${I(ICON.heart)}</span><div><b>${d.categories[0] ? esc(d.categories[0].label.split(/[ ,]/)[0]) : "None yet"}</b><span>Most common area</span></div></div></div>
      <div class="g2"><div class="pc rise" data-i="6"><h2>Visits per month</h2>${J.bar(
        d.monthly.slice(-6).map((m) => ({ label: m.label, value: m.count })),
        { label: "Your visits per month" },
      )}</div>
        <div class="pc rise" data-i="7"><h2>What you came for</h2>${J.donut(topCats(d.categories), { centerLabel: "visits" })}</div></div>
      <div class="pc rise" data-i="8"><h2>Clinic activity, last 7 days</h2><p class="sub">Anonymous check-ins across the whole clinic.</p>${J.spark(
        c.activity7d.map((a) => ({ label: a.label, value: a.count })),
        { label: "Clinic check-ins over the last 7 days" },
      )}</div>
      </section>`;
    J.animate(view);
    paintSlot(true);
  }

  /* ---------- Check in ---------- */
  async function checkin() {
    view.innerHTML = sk();
    const a = await api("/api/checkin/active");
    if (!a.ok) return oops();
    setActive(a.data.entry);
    view.innerHTML =
      '<section class="page"><div class="emergency rise" role="note"><strong>Emergency?</strong> If this is life-threatening, go to the clinic desk or call for help now. Do not wait for this app.</div><div id="slot"></div><div id="wizard" class="pc top-line" hidden></div></section>';
    if (S.active) {
      paintSlot(true);
      return;
    }
    if (!S.cats) {
      const s = await api("/api/checkin/symptoms");
      if (!s.ok) return oops();
      S.cats = s.data.categories;
    }
    const box = $("#wizard");
    box.hidden = false;
    stepCats(box);
  }
  function reset(box, n, title, sub) {
    box.replaceChildren();
    box.classList.remove("wiz");
    void box.offsetWidth;
    box.classList.add("wiz");
    if (n) {
      const d = el("div", "dots");
      for (let k = 1; k <= 3; k++) d.append(el("i", k <= n ? "on" : ""));
      box.append(d);
    }
    box.append(el("h2", "", title));
    if (sub) box.append(el("p", "sub sp", sub));
  }
  const back = (box, fn) => {
    const b = el("button", "link", "Back");
    b.type = "button";
    b.addEventListener("click", fn);
    box.append(b);
  };
  const opt = (t, fn) => {
    const b = el("button", "opt", t);
    b.type = "button";
    b.addEventListener("click", fn);
    return b;
  };
  const warn = (box, t) => {
    const m = el("div", "msg", t);
    m.setAttribute("role", "alert");
    box.append(m);
  };

  function stepCats(box) {
    reset(
      box,
      1,
      "What is the problem about?",
      "Pick the group that fits best.",
    );
    const l = el("div", "opts");
    S.cats.forEach((c) => l.append(opt(c.label, () => stepSyms(box, c))));
    box.append(l);
  }
  function stepSyms(box, cat) {
    reset(box, 2, cat.label, "Which one is closest to what you feel?");
    const l = el("div", "opts");
    cat.symptoms.forEach((s) =>
      l.append(opt(s.label, () => stepQs(box, cat, s))),
    );
    box.append(l);
    back(box, () => stepCats(box));
  }
  function stepQs(box, cat, sym) {
    reset(box, 3, sym.label, "Answer each question with Yes or No.");
    const answers = {};
    const go = el("button", "btn btn-green full", "Check in");
    go.type = "button";
    go.disabled = true;
    sym.questions.forEach((q) => {
      const fs = el("fieldset", "q");
      fs.append(el("legend", "", q.text));
      const row = el("div", "yn");
      [
        ["Yes", true],
        ["No", false],
      ].forEach(([lab, val]) => {
        const b = el("button", "", lab);
        b.type = "button";
        b.setAttribute("aria-pressed", "false");
        b.addEventListener("click", () => {
          answers[q.id] = val;
          row
            .querySelectorAll("button")
            .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
          go.disabled = !sym.questions.every(
            (x) => typeof answers[x.id] === "boolean",
          );
        });
        row.append(b);
      });
      fs.append(row);
      box.append(fs);
    });
    go.addEventListener("click", () => send(box, cat, sym, answers, false, go));
    box.append(go);
    back(box, () => stepSyms(box, cat));
  }
  async function send(box, cat, sym, answers, confirmMild, btn) {
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Checking in...";
    let r;
    try {
      r = await api("/api/checkin", {
        method: "POST",
        body: JSON.stringify({ symptomId: sym.id, answers, confirmMild }),
      });
    } catch (e) {
      btn.disabled = false;
      btn.textContent = label;
      return warn(
        box,
        "Cannot reach the server. Check your connection and try again.",
      );
    }
    if (r.ok && r.data.needsDecision === "pharmacy")
      return stepPharm(box, cat, sym, answers);
    if (r.ok)
      toast(
        "You are in the queue. Your number is " +
          r.data.entry.queueNumber +
          ".",
      );
    if (r.ok || r.status === 409) return checkin();
    btn.disabled = false;
    btn.textContent = label;
    warn(box, r.data.message || "Could not check you in. Please try again.");
  }
  function stepPharm(box, cat, sym, answers) {
    reset(
      box,
      0,
      "This sounds minor",
      "The campus pharmacy may be able to help you faster. This is only a suggestion. You can still see the doctor.",
    );
    const row = el("div", "two");
    const ph = el("button", "btn btn-line", "Visit the pharmacy");
    ph.type = "button";
    const jn = el("button", "btn btn-line", "Join the doctor\u2019s queue");
    jn.type = "button";
    ph.addEventListener("click", () => {
      reset(
        box,
        0,
        "No problem",
        "You have not been added to the queue. If your symptoms get worse, check in again.",
      );
      const again = el("button", "btn btn-green mt", "Check in anyway");
      again.type = "button";
      again.addEventListener("click", () => stepPharm(box, cat, sym, answers));
      box.append(again);
    });
    jn.addEventListener("click", () => send(box, cat, sym, answers, true, jn));
    row.append(ph, jn);
    box.append(el("div", "pharm", "Both options are open to you."), row);
    back(box, () => stepQs(box, cat, sym));
  }

  /* ---------- My visits ---------- */
  async function visits() {
    view.innerHTML = sk();
    const r = await api("/api/patient/history");
    if (!r.ok) return oops();
    const all = r.data.visits;
    let f = "All",
      q = "";
    view.innerHTML = `<section class="page"><div class="tools rise"><input id="vq" class="search" type="search" placeholder="Search symptom or area" aria-label="Search visits"><button class="fchip" data-f="All" aria-pressed="true">All</button><button class="fchip" data-f="Completed" aria-pressed="false">Completed</button><button class="fchip" data-f="No-show" aria-pressed="false">No-show</button><button id="csv" class="btn btn-line" type="button">Download CSV</button></div>
      <p class="sub">Your past check-ins. Doctor notes are private and not shown here.</p><div class="pc rise" data-i="1"><div id="vlist"></div></div></section>`;
    const draw = () => {
      const rows = all.filter(
        (v) =>
          (f === "All" || v.outcome === f) &&
          (v.symptom + " " + v.category).toLowerCase().includes(q),
      );
      $("#vlist").innerHTML = rows.length
        ? rows
            .map(
              (v, i) =>
                `<div class="visit" data-i="${Math.min(i, 12)}"><div><b>${esc(v.symptom)}</b><small>${esc(v.category)} &middot; ${esc(v.queueNumber)} &middot; ${fmt(v.date)}</small></div><span class="badge ${v.outcome === "Completed" ? "ok" : ""}">${esc(v.outcome)}</span></div>`,
            )
            .join("")
        : '<p class="empty">No visits to show yet. Finished check-ins will appear here.</p>';
      J.animate($("#vlist"));
    };
    $("#vq").addEventListener("input", (e) => {
      q = e.target.value.trim().toLowerCase();
      draw();
    });
    $$(".fchip").forEach((b) =>
      b.addEventListener("click", () => {
        f = b.dataset.f;
        $$(".fchip").forEach((x) =>
          x.setAttribute("aria-pressed", String(x === b)),
        );
        draw();
      }),
    );
    $("#csv").addEventListener("click", () => {
      const rows = [
        ["Date", "Queue number", "Area", "Symptom", "Outcome"],
        ...all.map((v) => [
          fmt(v.date),
          v.queueNumber,
          v.category,
          v.symptom,
          v.outcome,
        ]),
      ];
      const csv = rows
        .map((x) =>
          x.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(","),
        )
        .join("\n");
      const a = el("a");
      a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      a.download = "juahali-visits.csv";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast("Your visit history was downloaded.");
    });
    draw();
  }

  /* ---------- Insights ---------- */
  async function insights() {
    view.innerHTML = sk();
    const r = await api("/api/patient/insights");
    if (!r.ok) return oops();
    const d = r.data,
      done = d.outcomes.completed,
      total = done + d.outcomes.noShow,
      rate = total ? Math.round((100 * done) / total) : 0;
    const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const wd = [1, 2, 3, 4, 5, 6, 0].map((k, i) => ({
      label: names[i],
      value: d.weekday[k],
    }));
    const busy = wd.reduce((a, b) => (b.value > a.value ? b : a), wd[0]);
    view.innerHTML = `<section class="page">
      <div class="g2e"><div class="pc rise"><h2>Attendance</h2><div class="donut"><div>${ring(rate / 100, `<b><span data-count="${rate}">0</span>%</b><small>attended</small>`)}</div><ul class="legend"><li><i class="sw" data-c="1"></i><span>Completed</span><b>${done}</b></li><li><i class="sw" data-c="0"></i><span>No-show</span><b>${d.outcomes.noShow}</b></li></ul></div></div>
        <div class="pc rise" data-i="1"><h2>Your busiest day</h2><div class="bignum mt">${d.total ? busy.label : "None yet"}</div><p class="sub">Average ${(d.total / 12).toFixed(1)} check-ins a month over the last year.</p></div></div>
      <div class="pc rise" data-i="2"><h2>Visits in the last 12 months</h2>${J.bar(
        d.monthly.map((m) => ({ label: m.label, value: m.count })),
        { label: "Visits per month, last 12 months" },
      )}</div>
      <div class="g2e"><div class="pc rise" data-i="3"><h2>By area</h2>${J.donut(topCats(d.categories), { centerLabel: "visits" })}</div>
        <div class="pc rise" data-i="4"><h2>By weekday</h2>${J.bar(wd, { label: "Visits by weekday", h: 200 })}</div></div>
      <div class="pc rise" data-i="5"><h2>Clinic activity, last 7 days</h2><p class="sub">Anonymous check-ins across the whole clinic.</p>${J.spark(
        d.clinic.activity7d.map((a) => ({ label: a.label, value: a.count })),
        { label: "Clinic check-ins over the last 7 days" },
      )}</div></section>`;
    J.animate(view);
  }

  /* ---------- Help ---------- */
  function help() {
    const qa = [
      [
        "How is my place in the queue decided?",
        "You answer a few Yes or No questions about your symptoms. The clinic uses your answers, not a label you pick, to decide how urgent your case is. The longer you wait, the higher you climb.",
      ],
      [
        "Can someone skip ahead of me?",
        "Only if their symptoms are more urgent. Waiting time also counts, so nobody is stuck behind newer cases forever.",
      ],
      [
        "What does the pharmacy suggestion mean?",
        "For very minor symptoms we may suggest the campus pharmacy to save you a wait. It is only a suggestion. You can always join the doctor\u2019s queue.",
      ],
      [
        "How accurate is the wait time?",
        "It is an estimate based on how many people are ahead of you. It will change as the clinic gets busier or quieter.",
      ],
      [
        "Who can see my details?",
        "You see your own history. Reception sees only what they need to run the queue, and doctor notes stay private to doctors.",
      ],
      [
        "What if it is an emergency?",
        "Go to the clinic desk or call for help straight away. Do not wait for this app.",
      ],
    ];
    view.innerHTML = `<section class="page"><div class="emergency rise" role="note"><strong>Emergency?</strong> If this is life-threatening, go to the clinic desk or call for help now.</div>
      <div class="pc rise" data-i="1"><h2>Frequently asked questions</h2>${qa.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}</div>
      <p class="sub">Still stuck? Ask at the clinic desk.</p></section>`;
    J.animate(view);
  }

  /* ---------- Profile ---------- */
  async function profile() {
    view.innerHTML = sk();
    const r = await api("/api/patient/summary");
    if (!r.ok) return oops();
    S.me = r.data.user;
    shell();
    view.innerHTML = `<section class="page"><div class="pc rise profile-head"><span class="avatar" aria-hidden="true">${esc(S.me.fullName.trim()[0] || "")}</span><div><h2>${esc(S.me.fullName)}</h2><p class="sub">${esc(S.me.email)}${S.me.since ? " &middot; member since " + fmt(S.me.since) : ""}</p></div></div>
      <form id="pf" class="pc rise" data-i="1" novalidate><h2>Your details</h2><label for="pn">Full name</label><input id="pn" value="${esc(S.me.fullName)}" autocomplete="name"><label for="pe">School email</label><input id="pe" value="${esc(S.me.email)}" disabled><label for="ps">Student ID (optional)</label><input id="ps" value="${esc(S.me.studentId)}"><div id="pm" role="status"></div><div class="mt"><button class="btn btn-green" type="submit">Save changes</button></div></form>
      <form id="pw" class="pc rise" data-i="2" novalidate><h2>Change password</h2><label for="cp">Current password</label><input id="cp" type="password" autocomplete="current-password"><label for="np">New password</label><input id="np" type="password" autocomplete="new-password"><p class="sub">At least 8 characters with a letter and a number.</p><label for="np2">Confirm new password</label><input id="np2" type="password" autocomplete="new-password"><div id="wm" role="status"></div><div class="mt"><button class="btn btn-green" type="submit">Update password</button></div></form>
      <button id="lo2" class="btn btn-line" type="button">Log out</button></section>`;
    J.animate(view);
    const say = (id, t, ok) => {
      const n = $(id);
      n.className = ok ? "ok-msg" : "err-msg";
      n.textContent = t;
    };
    $("#pf").addEventListener("submit", async (e) => {
      e.preventDefault();
      const x = await api("/api/patient/profile", {
        method: "PATCH",
        body: JSON.stringify({
          fullName: $("#pn").value,
          studentId: $("#ps").value,
        }),
      });
      if (x.ok) {
        S.me = x.data.user;
        shell();
        say("#pm", "Saved.", true);
        toast("Profile updated.");
      } else say("#pm", x.data.message || "Could not save.", false);
    });
    $("#pw").addEventListener("submit", async (e) => {
      e.preventDefault();
      if ($("#np").value !== $("#np2").value)
        return say("#wm", "The new passwords do not match.", false);
      const x = await api("/api/patient/password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: $("#cp").value,
          newPassword: $("#np").value,
        }),
      });
      if (x.ok) {
        $("#pw").reset();
        say("#wm", "Password updated.", true);
        toast("Password updated.");
      } else say("#wm", x.data.message || "Could not update.", false);
    });
    $("#lo2").addEventListener("click", logout);
  }

  /* ---------- Router, theme, live polling ---------- */
  const routes = { home, checkin, visits, insights, help, profile };
  function show() {
    const r = route();
    $("#ptitle").textContent = TITLES[r];
    $$("#nav a").forEach((a) => {
      if (a.dataset.r === r) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    Promise.resolve(routes[r]()).catch(oops);
    view.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }
  async function logout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
    location.href = "/login.html";
  }
  $("#logout").addEventListener("click", logout);
  $("#theme").addEventListener("click", () => {
    const next =
      document.documentElement.getAttribute("data-theme") === "dark"
        ? "light"
        : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("jh-theme", next);
    } catch (e) {
      /* storage unavailable */
    }
  });
  window.addEventListener("hashchange", show);

  let tick = 0;
  const pollNow = async () => {
    tick++;
    const live = $("#live");
    try {
      const r = await api("/api/checkin/active");
      if (!r.ok) throw new Error("offline");
      live.classList.remove("off");
      S.updated = Date.now();
      const before = S.active;
      setActive(r.data.entry);
      const cur = route();
      if (cur === "home" || cur === "checkin") {
        if (!!before !== !!S.active) {
          routes[cur]();
          return;
        }
        paintSlot(false);
      }
      if (cur === "home" && tick % 3 === 0) {
        const i = await api("/api/patient/insights");
        if (i.ok) updateSnap(i.data.clinic);
      }
    } catch (e) {
      live.classList.add("off");
    }
  };
  setInterval(pollNow, 10000);
  if (window.io) {
    try {
      io().on("queue:changed", pollNow);
    } catch (e) {
      /* polling still works */
    }
  }
  setInterval(() => {
    const s = Math.round((Date.now() - S.updated) / 1000);
    $("#livetxt").textContent = $("#live").classList.contains("off")
      ? "Reconnecting..."
      : "Live \u00B7 " + (s < 5 ? "just now" : s + "s ago");
  }, 1000);

  show();
})();
