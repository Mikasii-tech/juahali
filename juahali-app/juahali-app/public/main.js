(() => {
  "use strict";

  /* ---------- Header: scroll shadow + mobile menu ---------- */
  const header = document.querySelector(".site-header");
  const toggle = document.querySelector(".nav-toggle");
  const menu = document.getElementById("nav-menu");

  const onScroll = () =>
    header.classList.toggle("scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  function setMenu(open) {
    menu.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }
  toggle.addEventListener("click", () =>
    setMenu(toggle.getAttribute("aria-expanded") !== "true"),
  );
  menu.addEventListener("click", (e) => {
    if (e.target.closest("a")) setMenu(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setMenu(false);
  });
  document.addEventListener("click", (e) => {
    if (!header.contains(e.target)) setMenu(false);
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 860) setMenu(false);
  });

  /* ---------- Hero: sample live queue (static data, not the real queue) ---------- */
  const rows = [...document.querySelectorAll("[data-row]")];
  const aheadEl = document.querySelector("[data-ahead]");
  const waitEl = document.querySelector("[data-wait]");

  // Each frame: status of Q-014, Q-015, Q-016, patients ahead of "you", sample wait
  const frames = [
    { s: ["in", "called", "waiting"], ahead: 3, wait: "~ 24 min" },
    { s: ["done", "in", "called"], ahead: 2, wait: "~ 16 min" },
    { s: ["done", "done", "in"], ahead: 1, wait: "~ 8 min" },
    { s: ["done", "done", "done"], ahead: 0, wait: "You're next" },
  ];
  const label = {
    waiting: "Waiting",
    called: "Called",
    in: "In consultation",
    done: "Completed",
  };
  let i = 0;
  let timer = null;

  function render(n) {
    const f = frames[n];
    rows.forEach((row, k) => {
      const st = f.s[k];
      row.classList.remove("is-called", "is-in", "is-done");
      if (st === "called") row.classList.add("is-called");
      if (st === "in") row.classList.add("is-in");
      if (st === "done") row.classList.add("is-done");
      row.querySelector(".status").textContent = label[st];
    });
    aheadEl.textContent =
      f.ahead === 0
        ? "Please go to the desk"
        : f.ahead + (f.ahead === 1 ? " patient ahead" : " patients ahead");
    waitEl.textContent = f.ahead === 0 ? f.wait : "Estimated wait " + f.wait;
  }

  function start() {
    stop();
    timer = setInterval(() => {
      i = (i + 1) % frames.length;
      render(i);
    }, 3500);
  }
  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  render(0);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduce) {
    start();
    const board = document.querySelector(".board");
    board.addEventListener("mouseenter", stop);
    board.addEventListener("mouseleave", start);
    document.addEventListener("visibilitychange", () =>
      document.hidden ? stop() : start(),
    );
  }
})();

/* Logged-in nav: swaps "Log in" for "Go to dashboard" (works when served by the Express server) */
fetch("/api/auth/me", { credentials: "same-origin" })
  .then((r) => (r.ok ? r.json() : null))
  .then((d) => {
    if (!d || !d.user) return;
    const home = {
      patient: "/patient",
      receptionist: "/reception",
      doctor: "/doctor",
      admin: "/admin",
    }[d.user.role];
    const l = document.querySelector(".nav-login");
    if (l && home) {
      l.textContent = "Go to dashboard";
      l.href = home;
    }
  })
  .catch(() => {});
