# Tarea: unificar los menús duplicados y centralizar los iconos SVG del player

Refactor de deduplicación en el portfolio de Diego San Marcos (sitio estático,
JavaScript vanilla sin build). No cambia ningún comportamiento visible: mismo
aspecto, mismos textos, misma interacción. Solo elimina código duplicado.

## Contexto

Es una SPA sin frameworks: `index.html`/`proyecto.html` cargan `shared.js`
(router + idioma), `player.js` (reproductor global `DSM_Player`) y `app.js`
(vistas home y proyecto). La navegación interna nunca recarga el documento
(`DSM_SHARED.navigateTo` + route renderer registrado por app.js).

## Parte 1 — Menú unificado en app.js

Hoy hay DOS implementaciones casi idénticas del menú modal:

- Home: `HOME_MENU_LABELS`, `getHomeMenuLabels()`, `createMenuTile()`,
  `openHomeMenu()`, `renderHomeMenuContent()`, `closeHomeMenu()`
- Proyecto: `MENU_LABELS`, `getMenuLabels()`, `createMenuButtonOnce()`,
  `openMenu()`, `renderMenuContent()`, `closeMenu()`

Diferencias reales entre ambas:
1. El menú de proyecto tiene un item extra "volver" (navega a `getHomeUrl()`).
2. `HOME_MENU_LABELS` está indexado por `ES`/`EN`/`FR` (usa
   `DSM_SHARED.langCode()`) y `MENU_LABELS` por `es`/`en`/`fr` (usa
   `DSM_SHARED.lang()`). Los textos son los mismos.
3. Tras cambiar idioma, la home re-renderiza el grid (`renderProjects()`) y el
   proyecto re-renderiza SEO (`updateProjectSEO()`) y el texto del botón
   trigger `.menu-trigger`.

Unificar en una sola implementación:

- Un solo diccionario `MENU_LABELS` (elige una convención de clave, da igual
  cuál, y usa el getter de idioma correspondiente).
- Una sola función `openMenu({ showBack })` (o parámetro equivalente) que
  monta overlay + modal + items. El frame 9-slice del modal se lee de
  `appData.modes[currentMode].frame` en ambos casos — ya es idéntico.
- Una sola `closeMenu()` y una sola función de render de items que reciba qué
  items mostrar o un flag `showBack`, y un callback/branch para lo que hay que
  re-renderizar al cambiar idioma según la vista (`currentView` ya existe como
  variable global: `'home' | 'project'`).
- `createMenuTile()` (tile de la home) y `createMenuButtonOnce()` (botón
  flotante de proyecto) se quedan como están, solo llaman a la función
  unificada.
- OJO: `renderRoute()` en app.js hace `document.querySelector('.menu-overlay')`
  y lo elimina al navegar — mantener el nombre de clase `.menu-overlay` y la
  clase `.closing` (la animación de cierre de styles.css depende de ellas).

## Parte 2 — Objeto ICONS en player.js

En `player.js` hay strings de SVG inline repetidos:

- play y pause: en el HTML inicial de `createPlayerDOM()` y otra vez en
  `updatePlayButton()` (y pause otra vez en `updateAutoCycleBtn()`).
- fullscreen expandir/contraer: en `createPlayerDOM()` y en
  `toggleFullscreen()`.
- volumen (mute / bajo / alto): en `createPlayerDOM()` y en `syncVolumeUI()`.

Crear un objeto `ICONS` (const al principio de player.js o propiedad de
`DSM_Player`) con cada SVG definido UNA vez, parametrizando el tamaño si hace
falta (play/pause se usan a 16px en el botón principal y 10px en el botón de
ciclo de presets), y sustituir todos los usos. No cambiar ningún path SVG.

## Verificación

Servir el sitio en local (`python3 -m http.server` vale, es estático) y
comprobar manualmente:

1. Home → tile "menu": abre modal; "abrir reproductor" carga el BGM;
   "cambiar idioma" re-renderiza tiles y el propio menú; "cerrar menu" cierra
   con la animación.
2. Entrar a un proyecto (ej. `/p/lotura/`) → botón "menu": mismo modal + item
   "volver" que navega a la home SIN recargar el documento (el player debe
   seguir sonando).
3. Player: play/pause alterna iconos, volumen cambia de icono según nivel,
   fullscreen alterna expandir/contraer, botón de ciclo de presets alterna
   play/pause pequeño.
4. Cambiar idioma dentro del menú de proyecto actualiza el texto del botón
   trigger.

## Al terminar

- Borrar este archivo (`PROMPT_MENU_REFACTOR.md`).
- Hacer commit de todo (mensaje estilo `refactor: unify menus + centralize player icons`,
  terminando con la línea `Co-Authored-By: Claude <noreply@anthropic.com>`)
  y `git push` a `main`.
