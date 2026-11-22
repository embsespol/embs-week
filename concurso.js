/* EMBS Week 2026 — Concurso de fotografía (página pública)
   Galería de fotos aprobadas, likes sin conteo público y envío de fotos. */
(() => {
  "use strict";

  const C = window.EMBS_CONFIG;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "embs-week-auth" }
  });
  const store = sb.storage.from(C.bucket);
  const publicUrl = (path) => store.getPublicUrl(path).data.publicUrl;
  const isOpen = () => Date.now() < Date.parse(C.closesAt);

  /* ---------- Mensajes ---------- */
  const toastEl = $("[data-toast]");
  let toastT;
  const toast = (msg) => {
    toastEl.textContent = msg;
    toastEl.classList.add("is-on");
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove("is-on"), 4200);
  };
  const friendly = (err) => {
    const m = String(err?.message || err || "");
    if (m.includes("TOO_MANY") || m.includes("COOLDOWN")) return "Enviaste muchas fotos en poco tiempo. Espera un rato e inténtalo de nuevo.";
    if (m.includes("CONTEST_CLOSED")) return "El concurso ya cerró. ¡Gracias por participar!";
    if (m.includes("TOO_FAST")) return "Vas muy rápido. Espera un momento y vuelve a intentarlo.";
    if (m.includes("row-level security") || m.includes("Unauthorized") || m.includes("403"))
      return "No pudimos subir la foto. Inténtalo de nuevo en unos minutos.";
    if (m.includes("captcha")) return "No pudimos verificar que eres una persona. Recarga la página e inténtalo de nuevo.";
    if (m.includes("Failed to fetch") || m.includes("NetworkError")) return "Sin conexión. Revisa tu internet e inténtalo de nuevo.";
    return "Algo salió mal. Inténtalo de nuevo en un momento.";
  };

  /* ---------- Verificación anti-bots (Cloudflare Turnstile) ---------- */
  // Un widget por contenedor: la página y cada diálogo abierto tienen el suyo,
  // para que el desafío (si aparece) quede visible sobre el diálogo.
  const widgets = new Map();
  let tsWaiter = null;
  const whenTurnstile = () => new Promise((res, rej) => {
    const t0 = Date.now();
    (function poll() {
      if (window.turnstile) return res(window.turnstile);
      if (Date.now() - t0 > 15000) return rej(new Error("captcha-load"));
      setTimeout(poll, 150);
    })();
  });
  const captchaToken = async () => {
    const ts = await whenTurnstile();
    const host = $("dialog[open] [data-captcha]") || $("body > [data-captcha]");
    return new Promise((resolve, reject) => {
      tsWaiter = { resolve, reject };
      let id = widgets.get(host);
      if (id === undefined) {
        id = ts.render(host, {
          sitekey: C.turnstileSiteKey,
          appearance: "interaction-only",
          execution: "execute",
          language: "es",
          callback: (t) => { tsWaiter?.resolve(t); tsWaiter = null; },
          "error-callback": () => { tsWaiter?.reject(new Error("captcha")); tsWaiter = null; },
          "expired-callback": () => ts.reset(id)
        });
        widgets.set(host, id);
      } else {
        ts.reset(id);
      }
      ts.execute(id);
      setTimeout(() => { if (tsWaiter) { tsWaiter.reject(new Error("captcha-timeout")); tsWaiter = null; } }, 90000);
    });
  };

  /* Sesión anónima: identifica el navegador para los likes y envíos */
  let sessionPromise = null;
  const ensureSession = () => {
    if (!sessionPromise) {
      sessionPromise = (async () => {
        const { data: { session } } = await sb.auth.getSession();
        if (session) return session;
        const token = await captchaToken();
        const { data, error } = await sb.auth.signInAnonymously({ options: { captchaToken: token } });
        if (error) throw error;
        return data.session;
      })().catch((e) => { sessionPromise = null; throw e; });
    }
    return sessionPromise;
  };

  /* ---------- Galería ---------- */
  const grid = $("[data-grid]");
  const empty = $("[data-empty]");
  let photos = [];

  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const credit = (p) => [p.author, p.instagram ? "@" + p.instagram : ""].filter(Boolean).join(" · ");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const likeBtnHTML = (p) => `
    <button class="like" type="button" data-like="${p.id}" aria-pressed="${p.liked}" ${isOpen() ? "" : "disabled"}>
      <svg aria-hidden="true"><use href="#i-heart"/></svg><span class="sr-only">Me gusta: ${esc(p.title)}</span>
    </button>`;

  const render = () => {
    grid.setAttribute("aria-busy", "false");
    empty.hidden = photos.length > 0;
    grid.hidden = photos.length === 0;
    grid.innerHTML = photos.map((p, i) => `
      <article class="shot" style="--ar:${p.width && p.height ? p.width / p.height : 1.33}">
        <button class="shot__open" type="button" data-open="${i}" aria-label="Ver foto: ${esc(p.title)}">
          <img src="${publicUrl(p.thumb_path)}" alt="${esc(p.title)}" loading="lazy" decoding="async" width="${p.width || 800}" height="${p.height || 600}">
        </button>
        <div class="shot__bar">
          <div class="shot__txt">
            <p class="shot__title">${esc(p.title)}</p>
            ${credit(p) ? `<p class="shot__by">${esc(credit(p))}</p>` : ""}
          </div>
          ${likeBtnHTML(p)}
        </div>
      </article>`).join("");
  };

  const loadGallery = async () => {
    const { data, error } = await sb.rpc("get_gallery");
    if (error) { grid.setAttribute("aria-busy", "false"); grid.innerHTML = `<p class="gallery__error">No pudimos cargar la galería. Recarga la página.</p>`; return; }
    photos = shuffle(data || []);
    render();
  };

  /* ---------- Likes (sin conteo público) ---------- */
  const pending = new Set();
  const paintLike = (p) => {
    $$(`[data-like="${p.id}"]`).forEach((b) => b.setAttribute("aria-pressed", String(p.liked)));
    if (viewer.open && photos[current]?.id === p.id) syncViewerLike();
  };
  const toggleLike = async (p, btn) => {
    if (!isOpen()) return toast("El concurso ya cerró. ¡Gracias por participar!");
    if (pending.has(p.id)) return; // evita dobles toques
    pending.add(p.id);
    const next = !p.liked;
    p.liked = next;
    paintLike(p);
    if (next) { btn?.classList.remove("pop"); void btn?.offsetWidth; btn?.classList.add("pop"); }
    try {
      await ensureSession();
      const { error } = await sb.rpc("set_like", { p_photo: p.id, p_like: next });
      if (error) throw error;
    } catch (e) {
      p.liked = !next;
      paintLike(p);
      toast(friendly(e));
    } finally {
      pending.delete(p.id);
    }
  };

  grid.addEventListener("click", (e) => {
    const likeBtn = e.target.closest("[data-like]");
    if (likeBtn) { const p = photos.find((x) => x.id === likeBtn.dataset.like); if (p) toggleLike(p, likeBtn); return; }
    const open = e.target.closest("[data-open]");
    if (open) openViewer(Number(open.dataset.open));
  });

  /* ---------- Visor ---------- */
  const viewer = $("[data-viewer]");
  const vImg = $("[data-viewer-img]");
  const vLike = $("[data-viewer-like]");
  let current = 0;
  const syncViewerLike = () => {
    const p = photos[current];
    vLike.setAttribute("aria-pressed", String(p.liked));
    vLike.disabled = !isOpen();
    $("[data-like-label]", vLike).textContent = p.liked ? "Te gusta" : "Me gusta";
  };
  const showPhoto = (i) => {
    current = (i + photos.length) % photos.length;
    const p = photos[current];
    vImg.src = publicUrl(p.thumb_path);              // miniatura inmediata
    const full = new Image();
    full.onload = () => { if (photos[current] === p) vImg.src = full.src; };
    full.src = publicUrl(p.path);
    vImg.alt = p.title;
    $("[data-viewer-title]").textContent = p.title;
    $("[data-viewer-by]").textContent = credit(p);
    syncViewerLike();
    // precarga de la siguiente
    const n = photos[(current + 1) % photos.length];
    if (n) new Image().src = publicUrl(n.path);
  };
  const openViewer = (i) => { showPhoto(i); viewer.showModal(); };
  $("[data-prev]").addEventListener("click", () => showPhoto(current - 1));
  $("[data-next]").addEventListener("click", () => showPhoto(current + 1));
  vLike.addEventListener("click", () => toggleLike(photos[current], vLike));
  viewer.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") showPhoto(current - 1);
    if (e.key === "ArrowRight") showPhoto(current + 1);
  });
  viewer.addEventListener("click", (e) => { if (e.target === viewer) viewer.close(); });
  // deslizar en el teléfono
  let sx = null;
  viewer.addEventListener("pointerdown", (e) => { sx = e.clientX; });
  viewer.addEventListener("pointerup", (e) => {
    if (sx === null) return;
    const dx = e.clientX - sx; sx = null;
    if (Math.abs(dx) > 50) showPhoto(current + (dx < 0 ? 1 : -1));
  });
  // doble toque sobre la foto = like (como en Instagram)
  vImg.addEventListener("dblclick", () => { if (!photos[current].liked) toggleLike(photos[current], vLike); });

  $$("[data-close]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));

  /* ---------- Mis envíos ---------- */
  const STATUS = { pending: "En revisión", approved: "Publicada", rejected: "No aprobada" };
  const loadMine = async () => {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;
    const { data } = await sb.rpc("my_photos");
    if (!data?.length) return;
    $("[data-mine]").hidden = false;
    $("[data-mine-list]").innerHTML = data.map((p) => `
      <li class="mine__item mine__item--${p.status}">
        <img src="${publicUrl(p.thumb_path)}" alt="" loading="lazy">
        <span><b>${esc(p.title)}</b><i>${STATUS[p.status] || p.status}</i></span>
      </li>`).join("");
  };

  /* ---------- Subida ---------- */
  const dlg = $("[data-upload]");
  const form = $("[data-form]");
  const fileInput = $("[data-file]");
  const preview = $("[data-preview]");
  const drop = $("[data-drop]");
  const statusEl = $("[data-status]");
  const submitBtn = $("[data-submit]");
  let prepared = null; // { full, thumb, width, height }

  const setErr = (name, msg) => { const el = $(`[data-error-for="${name}"]`); if (el) el.textContent = msg || ""; };
  const clearErrs = () => $$("[data-error-for]").forEach((el) => (el.textContent = ""));

  const decode = async (file) => {
    try { return await createImageBitmap(file, { imageOrientation: "from-image" }); }
    catch {
      const url = URL.createObjectURL(file);
      try { const img = new Image(); img.src = url; await img.decode(); return img; }
      finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
    }
  };
  // Redimensiona y vuelve a codificar en JPG (también elimina los metadatos, como la ubicación GPS)
  const encode = (src, max, q) => {
    const w0 = src.width, h0 = src.height;
    const s = Math.min(1, max / Math.max(w0, h0));
    const w = Math.round(w0 * s), h = Math.round(h0 * s);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    c.getContext("2d").drawImage(src, 0, 0, w, h);
    return new Promise((res, rej) => c.toBlob((b) => (b ? res({ blob: b, w, h }) : rej(new Error("encode"))), "image/jpeg", q));
  };

  fileInput.addEventListener("change", async () => {
    setErr("file", "");
    prepared = null;
    const f = fileInput.files[0];
    if (!f) return;
    if (f.size > 30 * 1024 * 1024) { setErr("file", "La foto pesa más de 30 MB. Elige otra o redúcela."); fileInput.value = ""; return; }
    drop.classList.add("is-busy");
    try {
      const bmp = await decode(f);
      const full = await encode(bmp, 2000, 0.85);
      const thumb = await encode(bmp, 720, 0.78);
      bmp.close?.();
      prepared = { full: full.blob, thumb: thumb.blob, width: full.w, height: full.h };
      preview.src = URL.createObjectURL(thumb.blob);
      preview.hidden = false;
      drop.classList.add("has-file");
    } catch {
      setErr("file", "No pudimos leer esta imagen. Si es HEIC, compártela o expórtala como JPG e inténtalo de nuevo.");
      fileInput.value = "";
      drop.classList.remove("has-file");
      preview.hidden = true;
    } finally {
      drop.classList.remove("is-busy");
    }
  });

  const titleIn = form.elements.title;
  titleIn.addEventListener("input", () => { $("[data-count]").textContent = `${titleIn.value.length}/60`; setErr("title", ""); });
  const igIn = form.elements.instagram;
  const igCheck = form.elements.show_instagram;
  igIn.addEventListener("input", () => {
    setErr("instagram", "");
    const has = igIn.value.trim().replace(/^@/, "").length > 0;
    igCheck.disabled = !has;
    if (!has) igCheck.checked = false;
    $("[data-ig-check]").classList.toggle("is-disabled", !has);
  });
  $("[data-ig-check]").classList.add("is-disabled");
  ["name", "contact"].forEach((n) => form.elements[n].addEventListener("input", () => setErr(n, "")));
  form.elements.consent.addEventListener("change", () => setErr("consent", ""));

  const validate = () => {
    clearErrs();
    let ok = true;
    const f = form.elements;
    if (!prepared) { setErr("file", "Elige una foto."); ok = false; }
    if (!f.title.value.trim()) { setErr("title", "Escribe un título para tu foto."); ok = false; }
    if (f.name.value.trim().length < 2) { setErr("name", "Escribe tu nombre."); ok = false; }
    const ig = f.instagram.value.trim().replace(/^@/, "");
    if (ig && !/^[A-Za-z0-9._]{1,30}$/.test(ig)) { setErr("instagram", "Usa solo letras, números, puntos y guiones bajos."); ok = false; }
    const ct = f.contact.value.trim();
    const isMail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(ct);
    const isPhone = /^\+?[\d\s()-]{7,20}$/.test(ct);
    if (!isMail && !isPhone) { setErr("contact", "Escribe un correo o un número de teléfono válido."); ok = false; }
    if (!f.consent.checked) { setErr("consent", "Necesitamos tu autorización para publicar la foto."); ok = false; }
    if (!ok) $(".field__error:not(:empty)")?.scrollIntoView({ block: "center", behavior: "smooth" });
    return ok;
  };

  const openUpload = async () => {
    if (!isOpen()) return toast("El concurso ya cerró. ¡Gracias por participar!");
    $("[data-done]").hidden = true;
    form.hidden = false;
    statusEl.textContent = "";
    dlg.showModal();
    ensureSession().catch(() => {}); // prepara la sesión mientras la persona llena el formulario
  };
  $$("[data-open-upload]").forEach((b) => b.addEventListener("click", openUpload));
  const again = Object.assign(document.createElement("button"), { type: "button", className: "btn btn--brand", textContent: "Subir otra foto" });
  again.addEventListener("click", () => { $("[data-done]").hidden = true; form.hidden = false; statusEl.textContent = ""; });
  $("[data-done] [data-close]").before(again);
  if (location.hash === "#subir") openUpload();
  window.addEventListener("hashchange", () => { if (location.hash === "#subir") openUpload(); });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate()) return;
    const f = form.elements;
    submitBtn.disabled = true;
    try {
      statusEl.textContent = "Verificando…";
      const session = await ensureSession();
      const uid = session.user.id;
      const id = (crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2));
      const path = `${uid}/${id}.jpg`;
      const thumb = `${uid}/${id}_t.jpg`;
      statusEl.textContent = "Subiendo foto…";
      const up1 = await store.upload(path, prepared.full, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
      if (up1.error) throw up1.error;
      const up2 = await store.upload(thumb, prepared.thumb, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
      if (up2.error) throw up2.error;
      statusEl.textContent = "Guardando…";
      const ig = f.instagram.value.trim().replace(/^@/, "");
      const { error } = await sb.rpc("submit_photo", {
        p_path: path, p_thumb: thumb,
        p_title: f.title.value.trim(), p_name: f.name.value.trim(),
        p_instagram: ig || null, p_contact: f.contact.value.trim(),
        p_show_name: f.show_name.checked, p_show_instagram: f.show_instagram.checked && !!ig,
        p_consent: f.consent.checked, p_width: prepared.width, p_height: prepared.height
      });
      if (error) throw error;
      form.reset();
      prepared = null;
      preview.hidden = true;
      drop.classList.remove("has-file");
      $("[data-count]").textContent = "0/60";
      form.hidden = true;
      $("[data-next-time]").textContent = "¿Tienes otra? Puedes subirla ahora mismo.";
      $("[data-done]").hidden = false;
      loadMine();
    } catch (err) {
      statusEl.textContent = "";
      toast(friendly(err));
    } finally {
      submitBtn.disabled = false;
    }
  });

  /* ---------- Concurso cerrado ---------- */
  if (!isOpen()) {
    $$("[data-open-upload]").forEach((b) => (b.hidden = true));
    $("[data-deadline]").textContent = "El concurso cerró el 29 de noviembre. Pronto anunciaremos la foto ganadora en nuestras redes sociales.";
  }

  loadGallery();
  loadMine();
})();
