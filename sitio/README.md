# EMBS Week 2026 · Página web — Etapa 1 (versión estática)

Abre `index.html` en el navegador. No necesita instalación ni servidor.

## Estructura

```
embs-week/
├── index.html          Contenido y estructura de todas las secciones
├── styles.css          Identidad visual: colores, tipografías, recursos gráficos, responsive
├── script.js           Menú, agenda desplegable y ganchos para la etapa 2
└── assets/
    ├── fonts/          Tipografías oficiales (ver abajo)
    └── img/
        ├── logos/      Logos recortados con fondo transparente
        ├── ponentes/   (vacía) fotos de ponentes — etapa 2
        └── sedes/      (vacía) fotos de sedes — etapa 2
```

## Secciones

| Ancla        | Sección |
|--------------|---------|
| `#inicio`    | Portada: logo, lema, fechas y tira de los 5 días (cada día abre su agenda) |
| `#evento`    | Sobre el evento, cifras y las tres organizaciones con su color |
| `#agenda`    | Agenda y ponentes: un desplegable por día (`#dia-1` … `#dia-5`) |
| `#sedes`     | Las tres sedes en bandas de color |
| `#registro`   | Tarjeta de registro con enlace al formulario de Google |
| `#organizan` | Organizado por / Auspiciado por / Con el apoyo de |

**Agenda:** con ratón, pasar el cursor muestra la vista parcial (fotos, ponentes y charlas). Con clic se abre el día completo (horas, modalidad, descanso y sede) y queda abierto. En móvil y tablet, un toque abre el día completo.

**Color por día:** cada día define `--c1` (color principal) y `--c2` (color claro) en su atributo `style`.
- Lunes: Biomedicina
- Martes y miércoles: Biotecnología
- Jueves y viernes: EMBS

## Tipografías

Copia los archivos en `assets/fonts/` con estos nombres. El formato `.woff2` es el recomendado.

- `Intro-Black.woff2`: logo y títulos
- `Intro-Bold.woff2`: nombres de sedes
- `IntroRust-Line.woff2`: etiquetas espaciadas (2DA EDICIÓN, ORGANIZADO POR…)
- `Gotham-Medium.woff2`: subtítulos y detalles

Mientras no estén, se usa Poppins como respaldo. Poppins se carga desde Google Fonts.

## Etapa 2: cómo integrar fotos y registro sin tocar el diseño

- **Foto de ponente:** rellena `data-photo` en su `<figure class="avatar">`. La imagen reemplaza automáticamente a las iniciales.
  `<figure class="avatar" data-photo="assets/img/ponentes/edwin-valarezo.webp" …>`
  Recomendación: imagen cuadrada de 600×600 px en formato WebP.
- **Foto de sede:** rellena `data-photo` en su `<article class="venue">`. Se coloca a la derecha con el velo de color del día.
- **Registro (Google Forms):** rellena `data-registro` en el `<a class="talk__cta">` de cada charla. El botón «Registrarme» aparece solo cuando tiene enlace.
- **Participación, galería y votaciones:** en `index.html` hay comentarios que marcan dónde van `#participa` y `#galeria`, y en el menú dónde van sus enlaces.

## Versión 2


- **Capa visual:** está al final de `styles.css`, en el bloque «VERSIÓN 2». Si borras ese bloque, la página vuelve a la versión 1.
- **Fotos:** las actuales se extrajeron de los flyers y son provisionales. Para cambiarlas, reemplaza los archivos manteniendo el mismo nombre:
  - Ponentes, en `assets/img/ponentes/`: edwin-valarezo, miguel-yapur, andres-nenger, ruben-puma, ulises-panora, jose-rendon, eduardo-sanchez, marynes-montiel, daniela-romero, karla-jaramillo, janeth-galarza, jonathan-zambrano, darwin-caina, michelle-viscaino, andres-navarro, fernanda-bertuccez, monica-huerta (`.webp`).
  - Sedes, en `assets/img/sedes/`: ups-centenario, espol-biblioteca, ups-maria-auxiliadora (`.webp`).
- **Animaciones:** se desactivan solas si el dispositivo tiene activada la opción de «reducir movimiento».

## Concurso de fotografía

- `concurso.html` + `concurso.js`: galería pública, likes y formulario de subida.
- `admin.html` + `admin.js`: panel privado para moderar, ver el ranking y descargar un CSV.
- `config.js`: dirección y clave pública de Supabase, clave de sitio de Turnstile, fecha de cierre.
- La lógica y la seguridad viven en Supabase. Los scripts SQL se entregan aparte y no deben publicarse.
