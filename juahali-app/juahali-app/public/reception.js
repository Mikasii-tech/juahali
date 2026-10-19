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
  const time = (d) =>
    new Date(d).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  const el = (tag, cls, txt) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  };
  const TITLES = { queue: "Live queue", activity: "Activity log" };
  const route = () => {
    const r = location.hash.replace("#/", "");
    return TITLES[r] ? r : "queue";
  };
  const S = {
    me: null,
    updated: Date.now(),
    seen: null,
    ranks: {},
    first: true,
    busy: false,
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
    if (r.status === 401) location.href = "/login.html";
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
  const tier = (t) =>
    `<span class="tier t-${String(t).toLowerCase()}">${esc(t)}</span>`;
  const ruleText = {
    critical: ["Critical, first", "crit"],
    ceiling: ["Waited too long, promoted", "ceil"],
    score: ["By urgency score", ""],
  };

  /* ---------- Live queue ---------- */
  function paint(d) {
    const first = S.first,
      next = d.waiting[0];
    const cls = first ? "rise" : "";
    const stat = (label, n, suffix) =>
      `<div class="pc stat ${cls}"><div><b>${first ? `<span data-count="${n}">0</span>` : n}${suffix || ""}</b><span>${label}</span></div></div>`;
    const serving = d.serving
      .map(
        (
          s,
        ) => `<div class="scard"><div><small>${esc(s.status)} &middot; ${s.minutes} min</small><b>${esc(s.queueNumber)} &middot; ${esc(s.name)}</b></div>
      ${s.status === "Called" ? `<button class="btn btn-line mini" data-act="noshow" data-id="${esc(s.id)}" type="button">No-show</button>` : '<span class="badge">With doctor</span>'}</div>`,
      )
      .join("");
    const rows = d.waiting
      .map((r) => {
        const [rt, rc] = ruleText[r.rule],
          moved = S.ranks[r.queueNumber] && S.ranks[r.queueNumber] !== r.rank;
        return `<div class="qrow ${moved ? "moved" : ""}"><span class="rk">${r.rank}</span>
        <div class="nm"><b>${esc(r.name)}</b><small>${esc(r.queueNumber)}</small></div>${"<div>" + tier(r.tier) + "</div>"}
        <span class="hm">${esc(r.area)}</span><span>${r.minutes} min</span>
        <span class="hm rule ${rc}">${rt}<br><small class="sub">score ${r.score}</small></span>
        <span class="hm sub">${r.lastVisit ? fmt(r.lastVisit) : "First visit"}</span>
        <button class="btn btn-line mini" data-act="call" data-id="${esc(r.id)}" type="button">Call</button></div>`;
      })
      .join("");
    view.innerHTML = `<section class="page">
      <div class="stats">${stat("Waiting", d.stats.waiting)}${stat("Now serving", d.serving.length)}${stat("Seen today", d.stats.seenToday)}${stat("No-shows", d.stats.noShows)}${stat("Longest wait", d.stats.longestWait, " min")}</div>
      <div class="pc actionbar ${cls}"><div><small>Next in line</small><h2>${next ? esc(next.queueNumber) + " &middot; " + esc(next.name) : "Nobody is waiting"}</h2>
        ${next ? `<div class="meta">${tier(next.tier)}<span class="sub">${esc(next.area)}</span></div>` : ""}</div>
        <button class="btn btn-green" data-act="call" type="button" ${next ? "" : "disabled"}>Call next patient</button></div>
      ${serving ? `<div class="sect"><h2>Now serving</h2></div><div class="serving">${serving}</div>` : ""}
      <div class="sect"><h2>Waiting (${d.waiting.length})</h2><span class="sub">Ranked by urgency</span></div>
      <div class="pc card-flat ${cls}">${d.waiting.length ? `<div class="qhead"><span>#</span><span>Patient</span><span>Tier</span><span class="hm">Area</span><span>Waited</span><span class="hm">Rule</span><span class="hm">Last visit</span><span></span></div>${rows}` : '<p class="empty">No patients are waiting right now.</p>'}</div></section>`;
    if (first) J.animate(view);
    S.first = false;
  }

  async function loadQueue() {
    if (S.busy) return;
    S.busy = true;
    try {
      const r = await api("/api/reception/queue");
      if (!r.ok) throw new Error("bad");
      const d = r.data;
      if (S.seen)
        d.waiting.forEach((w) => {
          if (!S.seen.has(w.queueNumber))
            toast("New check-in: " + w.queueNumber + " (" + w.tier + ")");
        });
      paint(d);
      S.seen = new Set(d.waiting.map((w) => w.queueNumber));
      S.ranks = Object.fromEntries(
        d.waiting.map((w) => [w.queueNumber, w.rank]),
      );
      S.updated = Date.now();
      $("#live").classList.remove("off");
    } catch (e) {
      $("#live").classList.add("off");
    } finally {
      S.busy = false;
    }
  }

  view.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    if (
      b.dataset.act === "noshow" &&
      !confirm("Mark this patient as a no-show?")
    )
      return;
    b.disabled = true;
    const r =
      b.dataset.act === "call"
        ? await api("/api/reception/call", {
            method: "POST",
            body: JSON.stringify(b.dataset.id ? { id: b.dataset.id } : {}),
          })
        : await api("/api/reception/noshow", {
            method: "POST",
            body: JSON.stringify({ id: b.dataset.id }),
          });
    if (r.ok)
      toast(
        b.dataset.act === "call"
          ? r.data.queueNumber + " has been called."
          : r.data.queueNumber + " marked as no-show.",
        "call",
      );
    else toast(r.data.message || "Could not do that.", "");
    S.busy = false;
    loadQueue();
  });

  /* ---------- Activity log ---------- */
  async function activity() {
    view.innerHTML =
      '<section class="page"><div class="sk h3"></div></section>';
    const r = await api("/api/reception/log");
    if (!r.ok) {
      view.innerHTML =
        '<section class="page"><div class="pc"><h2>Could not load the log.</h2></div></section>';
      return;
    }
    const rows = r.data.log
      .map(
        (l, i) =>
          `<div class="visit" data-i="${Math.min(i, 12)}"><div><b>${esc(l.queueNumber)}: ${esc(l.from)} &rarr; ${esc(l.to)}</b><small>${esc(l.by || "Unknown")} (${esc(l.role || "")}) &middot; ${fmt(l.at)} ${time(l.at)}</small></div></div>`,
      )
      .join("");
    view.innerHTML = `<section class="page"><p class="sub">Every status change is recorded with who made it and when. Records can never be edited or deleted.</p><div class="pc">${rows || '<p class="empty">No activity yet.</p>'}</div></section>`;
    J.animate(view);
  }

  /* ---------- Shell ---------- */
  function show() {
    const r = route();
    $("#ptitle").textContent = TITLES[r];
    $$("#nav a").forEach((a) => {
      if (a.dataset.r === r) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    if (r === "queue") {
      S.first = true;
      S.seen = null;
      loadQueue();
    } else activity();
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

  const refresh = () => {
    if (route() === "queue") loadQueue();
  };
  setInterval(refresh, 15000);
  if (window.io) {
    try {
      io().on("queue:changed", refresh);
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

  api("/api/auth/me").then((r) => {
    if (!r.ok) return;
    const n = r.data.user.fullName.trim();
    S.me = r.data.user;
    $("#sname").textContent = n;
    $("#savatar").textContent = n[0].toUpperCase();
    $("#chip").textContent = n[0].toUpperCase();
  });
  show();
})();
