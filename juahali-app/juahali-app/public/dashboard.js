(async () => {
  const res = await fetch("/api/auth/me", { credentials: "same-origin" });
  if (!res.ok) {
    location.href = "/login.html";
    return;
  }
  const { user } = await res.json();
  document.getElementById("who").textContent = user.fullName;
  document.getElementById("role").textContent = user.role;
  const out = document.getElementById("logout");
  if (user.role === "patient") {
    const a = document.createElement("a");
    a.className = "btn btn-green";
    a.href = "/patient/check-in";
    a.textContent = "Check in to the clinic";
    out.before(a);
  }
  out.addEventListener("click", async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
    location.href = "/login.html";
  });
})();
