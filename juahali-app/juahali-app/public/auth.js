(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const ROUTES = {
    patient: "/patient",
    receptionist: "/reception",
    doctor: "/doctor",
    admin: "/admin",
  };
  const next = new URLSearchParams(location.search).get("next");
  // Only whitelisted "next" values are used, so the link cannot send people to another site.
  const go = (role) => {
    location.href =
      role === "patient" && next === "check-in"
        ? "/patient/check-in"
        : ROUTES[role] || "/";
  };
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Already logged in? Skip the form.
  fetch("/api/auth/me", { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (d && d.user) go(d.user.role);
    })
    .catch(() => {});

  function fieldError(input, msg) {
    const err = document.getElementById(input.id + "-err");
    input.setAttribute("aria-invalid", msg ? "true" : "false");
    if (msg) input.setAttribute("aria-describedby", err.id);
    else input.removeAttribute("aria-describedby");
    err.textContent = msg || "";
    return !msg;
  }
  function alertBox(msg) {
    const a = $("#form-alert");
    a.textContent = msg || "";
    a.hidden = !msg;
  }
  function busy(btn, on) {
    btn.disabled = on;
    btn.querySelector(".btn-label").textContent = on
      ? btn.dataset.busy
      : btn.dataset.label;
    btn.querySelector(".spinner").hidden = !on;
  }
  async function post(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    let data = {};
    try {
      data = await res.json();
    } catch (e) {
      /* no body */
    }
    return { ok: res.ok, data };
  }

  document.querySelectorAll(".pw-toggle").forEach((b) =>
    b.addEventListener("click", () => {
      const input = b.parentElement.querySelector("input");
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      b.textContent = show ? "Hide" : "Show";
      b.setAttribute("aria-pressed", String(show));
      b.setAttribute("aria-label", show ? "Hide password" : "Show password");
    }),
  );

  const forgot = $("#forgot");
  if (forgot)
    forgot.addEventListener("click", () => {
      const n = $("#forgot-note");
      n.hidden = !n.hidden;
    });

  /* ---------- Login ---------- */
  const login = $("#login-form");
  if (login) {
    const email = $("#email"),
      pw = $("#password"),
      btn = login.querySelector("button[type=submit]");
    const vEmail = () =>
      fieldError(
        email,
        !email.value.trim()
          ? "Enter your email."
          : !EMAIL.test(email.value.trim())
            ? "Enter a valid email address."
            : "",
      );
    const vPw = () => fieldError(pw, pw.value ? "" : "Enter your password.");
    email.addEventListener("blur", vEmail);
    pw.addEventListener("blur", vPw);
    login.addEventListener("submit", async (e) => {
      e.preventDefault();
      alertBox("");
      const a = vEmail(),
        b = vPw();
      if (!a || !b) {
        (a ? pw : email).focus();
        return;
      }
      busy(btn, true);
      try {
        const { ok, data } = await post("/api/auth/login", {
          email: email.value.trim(),
          password: pw.value,
        });
        if (ok) return go(data.user.role);
        alertBox(data.message || "Login failed. Please try again.");
      } catch (err) {
        alertBox(
          "Cannot reach the server. Check your connection and try again.",
        );
      }
      busy(btn, false);
    });
  }

  /* ---------- Register ---------- */
  const reg = $("#register-form");
  if (reg) {
    const f = {
      fullName: $("#fullName"),
      email: $("#email"),
      password: $("#password"),
      confirm: $("#confirm"),
    };
    const btn = reg.querySelector("button[type=submit]");
    const rules = {
      len: (v) => v.length >= 8,
      letter: (v) => /[A-Za-z]/.test(v),
      num: (v) => /\d/.test(v),
    };
    const pwOk = (v) => Object.values(rules).every((r) => r(v));
    const v = {
      fullName: () =>
        fieldError(
          f.fullName,
          f.fullName.value.trim().length < 2 ? "Enter your full name." : "",
        ),
      email: () =>
        fieldError(
          f.email,
          !EMAIL.test(f.email.value.trim())
            ? "Enter a valid email address."
            : "",
        ),
      password: () =>
        fieldError(
          f.password,
          pwOk(f.password.value)
            ? ""
            : "Use at least 8 characters with a letter and a number.",
        ),
      confirm: () =>
        fieldError(
          f.confirm,
          f.confirm.value !== f.password.value || !f.confirm.value
            ? "Passwords do not match."
            : "",
        ),
    };
    Object.keys(v).forEach((k) => f[k].addEventListener("blur", v[k]));
    f.password.addEventListener("input", () => {
      document
        .querySelectorAll("#rules li")
        .forEach((li) =>
          li.classList.toggle("met", rules[li.dataset.rule](f.password.value)),
        );
    });
    reg.addEventListener("submit", async (e) => {
      e.preventDefault();
      alertBox("");
      const results = Object.keys(v).map((k) => v[k]());
      const firstBad = Object.keys(v)[results.indexOf(false)];
      if (firstBad) {
        f[firstBad].focus();
        return;
      }
      busy(btn, true);
      try {
        const { ok, data } = await post("/api/auth/register", {
          fullName: f.fullName.value.trim(),
          email: f.email.value.trim(),
          studentId: $("#studentId").value.trim(),
          password: f.password.value,
        });
        if (ok) return go(data.user.role);
        if (data.errors)
          Object.keys(data.errors).forEach(
            (k) => f[k] && fieldError(f[k], data.errors[k]),
          );
        alertBox(
          data.message || "Could not create your account. Please try again.",
        );
      } catch (err) {
        alertBox(
          "Cannot reach the server. Check your connection and try again.",
        );
      }
      busy(btn, false);
    });
  }
})();
