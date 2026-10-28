async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function currentUser() {
  try {
    return await api("/api/me");
  } catch {
    return null;
  }
}

function requireLogin(user) {
  if (!user) {
    location.href = "/auth.html";
    return false;
  }
  return true;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

async function renderHeader() {
  const nav = document.getElementById("nav");
  if (!nav) return;
  const user = await currentUser();
  if (user) {
    nav.innerHTML =
      `<span>${esc(user.displayName || user.email)} (${esc(user.role)})</span>` +
      (user.role === "author" ? `<a href="/editor.html">+ Resep</a>` : "") +
      `<a href="#" id="logout">Keluar</a>`;
    document.getElementById("logout").onclick = async (e) => {
      e.preventDefault();
      await api("/api/logout", { method: "POST" });
      location.href = "/";
    };
  } else {
    nav.innerHTML = `<a href="/auth.html">Masuk / Daftar</a>`;
  }
  return user;
}
