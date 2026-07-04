# Refactor: navegación SPA para que el reproductor de audio nunca se corte

## Contexto

Sitio estático (GitHub Pages, sin build) — portfolio de música de Diego San Marcos.
Stack: HTML + CSS + JS vanilla, sin frameworks. Todo el contenido se renderiza en
cliente desde `data/data.json`.

Estructura actual (MPA — multipágina):

- `index.html` + `app.js` — home: grid de tiles de proyectos. Al hacer click en un
  tile, `DSM_SHARED.navigateTo('./p/<slug>/')` hace un `window.location.href`
  (recarga completa).
- `proyecto.html` + `proyecto.js` — página de proyecto. Lee el slug de
  `window.DSM_PROJECT_SLUG` (inyectado por las páginas generadas) o del query
  `?p=<slug>`.
- `p/<slug>/index.html` — páginas generadas por `scripts/generate-project-pages.mjs`
  (copias de proyecto.html con `<base href="../../">`, meta tags SEO estáticos y el
  slug inyectado). Sirven para SEO y deep links. `404.html` redirige slugs
  desconocidos a `proyecto.html?p=<slug>`.
- `shared.js` — `DSM_SHARED`: idioma (localStorage `dsm_lang`), modo
  (portfolio/personal via `?modo=`), navegación con transición (`navigateTo`,
  clase `page-exit`), fuentes dinámicas, helpers SEO.
- `player.js` — `DSM_Player`: reproductor flotante global con `<audio>`, Web Audio
  analyser y visualizador Butterchurn (WebGL). Hoy "persiste" entre páginas
  guardando estado en `sessionStorage` (`dsm_player_state`, se guarda en
  `beforeunload` y en `saveState()`) y restaurándolo en `restoreState()` al cargar
  la página nueva: recarga el mp3, hace seek y reintenta `play()`.

## Problema

Al ser MPA, cada navegación destruye el documento entero — incluido el `<audio>`,
el AudioContext y el canvas WebGL. Resultado: el audio se corta en cada cambio de
página aunque el estado se restaure, y el visualizador se reinicia.

## Objetivo

Convertir la navegación interna en SPA para que `DSM_Player` **nunca se destruya**:
audio continuo sin cortes al entrar/salir de proyectos, cambiar de modo o volver a
la home. Manteniendo:

1. Deploy en GitHub Pages tal cual (estático, sin build ni servidor).
2. Las páginas generadas `p/<slug>/` como puntos de entrada SEO/deep-link (deben
   seguir funcionando al abrirlas directamente; arrancan la misma SPA).
3. El fallback `proyecto.html?p=<slug>` y la redirección de `404.html`.
4. URLs bonitas en la barra de direcciones (`/p/<slug>/`, `/?modo=personal`).
5. Botones atrás/adelante del navegador funcionando (popstate).

## Plan sugerido

1. Unificar `app.js` y `proyecto.js` en una sola app con dos vistas (home y
   proyecto) y un mini-router:
   - `data.json` ya contiene todo lo necesario para ambas vistas.
   - Las funciones de SEO ya existen (`updateHomeSEO` en app.js,
     `updateProjectSEO` en proyecto.js) — llamarlas al cambiar de vista.
   - `index.html` y las páginas generadas cargan el mismo bundle de scripts.
2. Sustituir `DSM_SHARED.navigateTo(url)` en la navegación interna por
   `history.pushState` + render de la vista en el mismo documento. Mantener una
   transición visual equivalente a la actual (fade con `page-exit`/entrada de
   tiles) pero sin recargar.
   - Puntos que hoy navegan: click en tile de proyecto (app.js), "volver" del menú
     y click-fuera-del-main (proyecto.js `setupClickOutsideBack`).
3. `popstate`: re-renderizar la vista que corresponda a la URL. Con esto los hacks
   de bfcache de `shared.js` (`pageshow`, limpieza de `page-exit`) dejan de ser
   necesarios para navegación interna — revisar si se pueden simplificar (cuidado:
   siguen aplicando si el usuario navega a un sitio externo y vuelve).
4. `player.js`: se inicializa una sola vez y no se toca al cambiar de vista.
   Mantener la persistencia en sessionStorage como red de seguridad para recargas
   completas (F5, deep link) — ya funciona y restaura también el estado en pausa.
5. Páginas generadas: ajustar `scripts/generate-project-pages.mjs` para que
   `p/<slug>/index.html` cargue la SPA completa (hoy solo carga los scripts de
   proyecto). Al abrir un deep link, la SPA arranca directamente en la vista de
   ese proyecto (leyendo `window.DSM_PROJECT_SLUG` o la ruta).

## ⚠️ Trampas conocidas (importante)

- **Rutas relativas + pushState**: todo el código usa rutas relativas
  (`./data/...`) y las páginas generadas dependen de `<base href="../../">`. Al
  hacer `pushState('/p/slug/')` desde `/`, las rutas relativas de fetch/img/audio
  creadas después resolverían contra `/p/slug/` y romperían. Solución recomendada:
  resolver una única vez la raíz del sitio al arrancar (p. ej. a partir de
  `document.baseURI` o de la URL del script) y construir TODAS las rutas de
  assets/fetch como absolutas desde esa raíz. Ojo: el sitio puede servirse desde
  un subpath (GH Pages de proyecto) — no hardcodear `/`.
- El `<audio>` ya tiene `MediaElementSource` conectado (solo se puede crear una
  vez por elemento) — no recrear el elemento audio jamás.
- `proyecto.js` añade `tipo-<tipo>` al `<body>` y borde 9-slice al `.project-main`
  — al cambiar de vista hay que limpiar clases/estilos de la vista anterior.
- El player en páginas de proyecto usa la clase `.project-page` del body para el
  tamaño móvil (ver styles.css / proyecto.css) — gestionarla en el cambio de vista.
- `renderProjects()` (home) se re-ejecuta en resize con debounce — asegurarse de
  que solo actúa cuando la vista home está activa.
- El menú modal y el overlay iris de cambio de modo viven en `document.body` —
  comprobar que sobreviven o se limpian bien entre vistas.
- Regenerar `sitemap.xml` no hace falta (las URLs no cambian).

## Verificación (usa un servidor local: `npx http-server -p 8734`)

Checklist manual/automatizable con el preview:

- [ ] Home → click proyecto con audio (p. ej. uno con playlist) → reproducir →
      volver a home → **el audio no se corta ni un frame** y el visualizador no
      parpadea.
- [ ] BGM por defecto (`data.json → bgm`) suena en la home; entrar y salir de
      proyectos no lo reinicia.
- [ ] Atrás/adelante del navegador entre home y varios proyectos: vista correcta,
      audio continuo.
- [ ] Deep link directo a `http://localhost:8734/p/feel/` funciona (imágenes,
      audio, textos).
- [ ] `proyecto.html?p=feel` sigue funcionando.
- [ ] Cambio de idioma y de modo (portfolio/personal) funcionan en ambas vistas;
      la URL refleja `?modo=personal`.
- [ ] F5 en `/p/<slug>/`: la página carga y el player restaura su estado
      (incluido en pausa).
- [ ] Sin errores en consola en todo el flujo.

## Después (opcional, solo si lo pide el usuario)

Campo opcional `bgm` por proyecto en `data.json`: al entrar en un proyecto que lo
defina, el player encadena esa pista (sin corte) y vuelve al BGM global al salir.
