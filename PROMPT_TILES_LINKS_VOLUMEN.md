# Tarea: tiles como enlaces reales + volumen persistente + zip para cliente

Sitio estático (GitHub Pages, sin build), HTML + CSS + JS vanilla. Portfolio de
música. Dos mejoras pequeñas e independientes, y al final regenerar el zip de
entrega al cliente.

## 1. Tiles de proyecto como enlaces `<a>` reales

**Hoy**: en `app.js`, `createProjectCard()` crea un `div.project-card` con un
click handler que llama a `DSM_SHARED.navigateTo('./p/<slug>/')` (navegación con
transición de salida). Problemas: Google no descubre las páginas `/p/<slug>/`
navegando (solo por sitemap), y los tiles no son accesibles por teclado.

**Cambio**: convertir el tile en `<a class="project-card" href="./p/<slug>/">`:

- Mantener la transición: en el click handler, `e.preventDefault()` y llamar a
  `DSM_SHARED.navigateTo(href)` como hasta ahora.
- **No interceptar** cmd/ctrl+click, click central ni shift+click (dejar que el
  navegador abra en pestaña nueva): si `e.metaKey || e.ctrlKey || e.shiftKey ||
  e.button !== 0`, no hacer preventDefault y salir.
- CSS (`styles.css`): el selector `.project-card` ya existe y el tile es item de
  un grid — añadir a la regla `text-decoration: none; color: inherit;` y
  comprobar que como `<a>` sigue ocupando su celda igual (los items de grid se
  blockifican solos, pero verificar visualmente).
- Los enlaces son arrastrables por defecto: añadir `draggable="false"` al `<a>`
  (ya hay `user-select: none` y `-webkit-user-drag: none` en tiles/imágenes —
  no romper eso).
- Ya existe un estilo `:focus-visible` para `.project-card` — comprobar que se
  ve al tabular y que Enter navega.
- Los tiles especiales (switch/idioma/menú) ya son `<button>` — no tocarlos.
- No tocar `slug` encoding: hoy usa `encodeURIComponent(project.slug)`.

## 2. Volumen persistente entre visitas

**Hoy**: en `player.js`, el volumen solo vive en el estado de sesión
(`sessionStorage dsm_player_state`); al cerrar la pestaña se olvida y vuelve a 0.7.

**Cambio**:

- En `setVolume()`: guardar también `localStorage.setItem('dsm_volume', ...)`.
- En `init()`: en vez de `this.element.volume = 0.7`, leer
  `localStorage.getItem('dsm_volume')` con fallback 0.7 (validar rango 0..1 y
  NaN).
- `restoreState()` aplica `state.volume` de la sesión — dejarlo (coincidirá con
  el último volumen de todos modos), pero que la sesión no pise un localStorage
  más reciente no es problema real; no complicarlo.
- `close()` no debe resetear el volumen.

## Verificación (servidor local: `npx http-server -p 8734 -c-1`)

- [ ] Click en tile → navega con la transición de fade como antes.
- [ ] Cmd+click (o click central) en tile → abre `/p/<slug>/` en pestaña nueva.
- [ ] Tab hasta un tile → se ve el foco → Enter navega.
- [ ] Arrastrar el ratón sobre un tile no lo arrastra como enlace ni selecciona texto.
- [ ] El grid se ve idéntico (tamaños, hover, colores de tile).
- [ ] Cambiar volumen del player → recargar la página → el volumen se mantiene.
- [ ] Cerrar el player (×), recargar → el volumen sigue siendo el elegido.
- [ ] Sin errores en consola.

## Al terminar

1. Commit (mensaje estilo repo, en inglés, prefijo `feat:`/`fix:`) y push a `main`.
2. Regenerar el zip de entrega al cliente con **todos** los ficheros cambiados
   desde el commit `46db672` (lo último que tiene el cliente), excluyendo los
   PROMPT_*.md:

   ```bash
   rm -f update-cliente-*.zip
   git log --name-only --format= 46db672..HEAD | sort -u | grep -v '^PROMPT' \
     | zip -q update-cliente-$(date +%Y-%m-%d).zip -@
   unzip -l update-cliente-*.zip
   ```

   El zip queda sin trackear en la raíz del repo; no commitearlo.

## Nota

Hay otro refactor mayor pendiente en `PROMPT_SPA_REFACTOR.md` (navegación SPA).
Esta tarea es independiente y compatible: si la SPA llega después, interceptará
los clicks de estos mismos enlaces. No hacer el refactor SPA en esta sesión.
