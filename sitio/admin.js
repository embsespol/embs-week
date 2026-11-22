/* EMBS Week 2026 — Panel de administración del concurso
   Solo funciona para los usuarios registrados en la tabla public.admins.
   La seguridad real está en la base de datos: este panel solo la usa. */
(() => {
  "use strict";

  const C = window.EMBS_CONFIG;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "embs-week-admin" }
  });
  const store = sb.storage.from(C.bucket);
  const url = (p) => store.getPublicUrl(p).data.publicUrl;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Guayaquil" });

  const toastEl = $("[data-toast]");
  let toastT;
  const toast = (m) => { toastEl.textContent = m; toastEl.classList.add("is-on"); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove("is-on"), 3800); };

  /* ---------- Turnstile para el inicio de sesión ---------- */
  let tsId = null, waiter = null;
  const token = () => new Promise((resolve, reject) => {
    const t0 = Date.now();
    (function go() {
      if (!window.turnstile) { if (Date.now() - t0 > 15000) return reject(new Error("captcha")); return setTimeout(go, 150); }
      waiter = { resolve, reject };
      if (tsId === null) {
        tsId = turnstile.render($("[data-captcha]"), {
          sitekey: C.turnstileSiteKey, appearance: "interaction-only", execution: "execute", language: "es",
          callback: (t) => { waiter?.resolve(t); waiter = null; },
          "error-callback": () => { waiter?.reject(new Error("captcha")); waiter = null; }
        });
      } else turnstile.reset(tsId);
      turnstile.execute(tsId);
    })();
  });

  /* ---------- Sesión ---------- */
  const loginBox = $("[data-login]");
  const panel = $("[data-panel]");
  const loginErr = $("[data-login-error]");

  const enter = async (session) => {
    const { data: isAdmin, error } = await sb.rpc("is_admin");
    if (error || !isAdmin) {
      await sb.auth.signOut();
      loginErr.textContent = "Esta cuenta no tiene permisos de administración.";
      return;
    }
    $("[data-user-email]").textContent = session.user.email;
    $("[data-userbox]").hidden = false;
    loginBox.hidden = true;
    panel.hidden = false;
    load();
  };

  $("[data-login-form]").addEventListener("submit", async (e) => {
    e.preventDefault();
    loginErr.textContent = "";
    const f = e.target.elements;
    if (!f.email.value || !f.password.value) { loginErr.textContent = "Escribe tu correo y contraseña."; return; }
    const btn = $("[data-login-btn]");
    btn.disabled = true;
    try {
      const captchaToken = await token();
      const { data, error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value, options: { captchaToken } });
      if (error) throw error;
      await enter(data.session);
    } catch (err) {
      loginErr.textContent = /invalid/i.test(err.message) ? "Correo o contraseña incorrectos." : "No se pudo iniciar sesión. Inténtalo de nuevo.";
    } finally { btn.disabled = false; }
  });

  $("[data-logout]").addEventListener("click", async () => { await sb.auth.signOut(); location.reload(); });

  /* ---------- Datos ---------- */
  let rows = [];
  let tab = "pending";

  const load = async () => {
    const { data, error } = await sb.rpc("admin_photos");
    if (error) { toast("No se pudieron cargar las fotos."); return; }
    rows = data || [];
    ["pending", "approved", "rejected"].forEach((s) => ($(`[data-n="${s}"]`).textContent = rows.filter((r) => r.status === s).length));
    $("[data-updated]").textContent = `Actualizado: ${fmt.format(new Date())}`;
    render();
  };

  const vis = (shown, val) => val ? `${esc(val)} <em class="${shown ? "is-yes" : "is-no"}">${shown ? "visible" : "oculto"}</em>` : "—";

  const card = (r) => `
    <article class="adm-card" data-id="${r.id}">
      <a class="adm-card__img" href="${url(r.path)}" target="_blank" rel="noopener" title="Abrir foto completa">
        <img src="${url(r.thumb_path)}" alt="" loading="lazy">
      </a>
      <div class="adm-card__body">
        <p class="adm-card__title">${esc(r.title)}</p>
        <dl class="adm-card__meta">
          <dt>Nombre</dt><dd>${vis(r.show_name, r.author_name)}</dd>
          <dt>Instagram</dt><dd>${r.instagram ? vis(r.show_instagram, "@" + r.instagram) : "—"}</dd>
          <dt>Contacto</dt><dd>${esc(r.contact)}</dd>
          <dt>Enviada</dt><dd>${fmt.format(new Date(r.created_at))}</dd>
          ${r.status === "approved" ? `<dt>Likes</dt><dd><b>${r.likes}</b></dd>` : ""}
        </dl>
        <div class="adm-card__actions">
          ${r.status !== "approved" ? `<button class="btn btn--ok btn--sm" data-act="approved">Aprobar</button>` : ""}
          ${r.status === "pending" ? `<button class="btn btn--ghost btn--sm" data-act="rejected">Rechazar</button>` : ""}
          ${r.status === "approved" ? `<button class="btn btn--ghost btn--sm" data-act="rejected">Retirar de la galería</button>` : ""}
          <button class="btn btn--danger btn--sm" data-act="delete">Eliminar</button>
        </div>
      </div>
    </article>`;

  const render = () => {
    const list = $("[data-list]");
    if (tab === "ranking") {
      const top = rows.filter((r) => r.status === "approved").sort((a, b) => b.likes - a.likes || new Date(a.created_at) - new Date(b.created_at));
      list.className = "adm-list adm-list--rank";
      list.innerHTML = top.length ? `
        <table class="adm-rank">
          <thead><tr><th>#</th><th>Foto</th><th>Título</th><th>Autor</th><th>Contacto</th><th>Likes</th></tr></thead>
          <tbody>${top.map((r, i) => `
            <tr><td>${i + 1}</td>
              <td><a href="${url(r.path)}" target="_blank" rel="noopener"><img src="${url(r.thumb_path)}" alt="" loading="lazy"></a></td>
              <td>${esc(r.title)}</td>
              <td>${esc(r.author_name)}${r.instagram ? `<br><small>@${esc(r.instagram)}</small>` : ""}</td>
              <td>${esc(r.contact)}</td>
              <td><b>${r.likes}</b></td></tr>`).join("")}
          </tbody></table>` : `<p class="adm-empty">Aún no hay fotos publicadas.</p>`;
      return;
    }
    const items = rows.filter((r) => r.status === tab);
    if (tab === "pending") items.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); // las más antiguas primero
    list.className = "adm-list";
    list.innerHTML = items.length ? items.map(card).join("") : `<p class="adm-empty">${{ pending: "No hay fotos pendientes de revisión.", approved: "Aún no hay fotos publicadas.", rejected: "No hay fotos rechazadas." }[tab]}</p>`;
  };

  $$("[data-tab]").forEach((b) => b.addEventListener("click", () => {
    tab = b.dataset.tab;
    $$("[data-tab]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    render();
  }));
  $("[data-refresh]").addEventListener("click", load);

  $("[data-list]").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const id = btn.closest("[data-id]").dataset.id;
    const r = rows.find((x) => x.id === id);
    const act = btn.dataset.act;
    if (act === "delete" && !confirm(`¿Eliminar definitivamente «${r.title}»? También se borrarán sus likes. Esta acción no se puede deshacer.`)) return;
    btn.disabled = true;
    try {
      if (act === "delete") {
        const { data, error } = await sb.rpc("admin_delete_photo", { p_photo: id });
        if (error) throw error;
        const paths = (data || []).flatMap((d) => [d.path, d.thumb_path]);
        if (paths.length) { const { error: e2 } = await store.remove(paths); if (e2) throw e2; }
        rows = rows.filter((x) => x.id !== id);
        toast("Foto eliminada.");
      } else {
        const { error } = await sb.rpc("admin_set_status", { p_photo: id, p_status: act });
        if (error) throw error;
        r.status = act;
        toast(act === "approved" ? "Foto publicada en la galería." : "Foto retirada.");
      }
      ["pending", "approved", "rejected"].forEach((s) => ($(`[data-n="${s}"]`).textContent = rows.filter((x) => x.status === s).length));
      render();
    } catch {
      toast("No se pudo completar la acción. Inténtalo de nuevo.");
      btn.disabled = false;
    }
  });

  /* CSV con todas las fotos (para anunciar el ganador y contactar) */
  $("[data-export]").addEventListener("click", () => {
    const cols = ["estado", "likes", "titulo", "nombre", "instagram", "mostrar_nombre", "mostrar_instagram", "contacto", "enviada", "foto"];
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [cols.join(",")].concat(
      [...rows].sort((a, b) => b.likes - a.likes).map((r) => [
        r.status, r.likes, r.title, r.author_name, r.instagram ? "@" + r.instagram : "", r.show_name ? "sí" : "no",
        r.show_instagram ? "sí" : "no", r.contact, fmt.format(new Date(r.created_at)), url(r.path)
      ].map(q).join(","))
    );
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "concurso-embs-week.csv" });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  // Actualiza la lista sola cada 60 s mientras el panel está abierto
  setInterval(() => { if (!panel.hidden && document.visibilityState === "visible") load(); }, 60000);

  /* Sesión previa */
  sb.auth.getSession().then(({ data: { session } }) => {
    if (session && !session.user.is_anonymous) enter(session);
  });
})();
