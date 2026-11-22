/* EMBS Week 2026 — Etapa 1: interacciones mínimas
   - Menú fijo y menú móvil
   - Agenda desplegable: hover = vista parcial, clic = vista completa (queda abierta)
   - Preparación para etapa 2: fotos (data-photo) y registro (data-registro) */
(() => {
  "use strict";

  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)");

  /* ---------- Navegación ---------- */
  const nav = document.querySelector("[data-nav]");
  const burger = document.querySelector("[data-burger]");
  const hero = document.getElementById("inicio");

  if (nav && hero && "IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      nav.classList.toggle("is-scrolled", !entry.isIntersecting);
    }, { rootMargin: "-80px 0px 0px 0px" }).observe(hero);
  }

  const setMenu = (open) => {
    nav.classList.toggle("is-menu-open", open);
    burger.setAttribute("aria-expanded", String(open));
    burger.querySelector(".sr-only").textContent = open ? "Cerrar menú" : "Abrir menú";
    document.body.style.overflow = open ? "hidden" : "";
  };
  burger?.addEventListener("click", () => setMenu(!nav.classList.contains("is-menu-open")));
  nav?.querySelectorAll(".nav__menu a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav?.classList.contains("is-menu-open")) { setMenu(false); burger.focus(); }
  });

  /* Sección activa en el menú */
  const links = [...document.querySelectorAll(".nav__menu a[href^='#']")];
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        links.forEach((l) => l.setAttribute("aria-current", String(l.hash === "#" + en.target.id)));
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    links.forEach((l) => { const s = document.querySelector(l.hash); if (s) io.observe(s); });
  }

  /* ---------- Agenda ---------- */
  const days = [...document.querySelectorAll("[data-day]")];

  const sync = (day) => {
    const open = day.classList.contains("is-open");
    const visible = open || day.classList.contains("is-peek");
    day.querySelector(".day__toggle").setAttribute("aria-expanded", String(open));
    const inner = day.querySelector(".day__inner");
    if (visible) inner.removeAttribute("inert"); else inner.setAttribute("inert", "");
  };

  const setOpen = (day, open) => {
    day.classList.toggle("is-open", open);
    if (!open) day.classList.remove("is-peek");
    sync(day);
  };

  days.forEach((day) => {
    const btn = day.querySelector(".day__toggle");
    const inner = day.querySelector(".day__inner");
    let enterT, leaveT;

    sync(day);

    btn.addEventListener("click", () => setOpen(day, !day.classList.contains("is-open")));

    // Clic en la vista parcial: abre el día completo
    inner.addEventListener("click", (e) => {
      if (!day.classList.contains("is-open") && !e.target.closest("a")) setOpen(day, true);
    });

    // Vista parcial al pasar el cursor (solo con ratón/trackpad)
    day.addEventListener("mouseenter", () => {
      if (!canHover.matches) return;
      clearTimeout(leaveT);
      enterT = setTimeout(() => { day.classList.add("is-peek"); sync(day); }, 140);
    });
    day.addEventListener("mouseleave", () => {
      clearTimeout(enterT);
      leaveT = setTimeout(() => { day.classList.remove("is-peek"); sync(day); }, 180);
    });
  });

  const openDayFromHash = (hash, scroll) => {
    const day = hash && document.querySelector(hash + "[data-day]");
    if (!day) return false;
    setOpen(day, true);
    if (scroll) day.scrollIntoView({ block: "start" });
    return true;
  };

  document.querySelectorAll("[data-open-day]").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      openDayFromHash("#" + a.dataset.openDay, true);
      history.replaceState(null, "", "#" + a.dataset.openDay);
    });
  });
  openDayFromHash(location.hash, false);

  /* ---------- Etapa 2: fotografías ----------
     Ponentes: <figure class="avatar" data-photo="assets/img/ponentes/nombre.webp">
     Sedes:    <article class="venue" data-photo="assets/img/sedes/sede.webp"> */
  document.querySelectorAll(".avatar[data-photo]").forEach((fig) => {
    const src = fig.dataset.photo.trim();
    if (!src) return;
    const img = new Image();
    img.alt = fig.dataset.name || "";
    img.loading = "lazy";
    img.decoding = "async";
    img.onload = () => fig.classList.add("has-photo");
    img.src = src;
    fig.prepend(img);
  });
  document.querySelectorAll(".venue[data-photo]").forEach((v) => {
    const src = v.dataset.photo.trim();
    if (!src) return;
    v.style.setProperty("--photo", `url("${src}")`);
    v.classList.add("has-photo");
  });

  /* ---------- Etapa 2: registro (Google Forms) ----------
     <a class="talk__cta" data-registro="https://forms.gle/..."> */
  document.querySelectorAll("[data-registro]").forEach((a) => {
    const url = a.dataset.registro.trim();
    if (!url) return;
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    a.hidden = false;
  });
})();
