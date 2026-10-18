# Diego San Marcos - Portfolio/Personal

Portfolio web de Diego San Marcos, compositor y diseñador sonoro. Diseño inspirado en las interfaces de Windows 10 con estética glassy y reproductor de audio persistente estilo Windows Media Player.

## Características

### Home
- **Cuadrados grandes** estilo Windows 10 con efecto glassy
- **Switch portfolio/personal** en la esquina inferior derecha
- **Fondos dinámicos** que cambian según el modo (portfolio/personal)
- **Colores diferenciados** por tipo de proyecto
- **Iconos minimalistas** para cada categoría

### Reproductor de Audio Persistente
- Diseño inspirado en **Windows Media Player** clásico (XP/Vista)
- Se mantiene visible al navegar entre páginas
- Reproducción en **bucle** de todos los audios del proyecto
- Controles completos: play/pause, anterior/siguiente, progreso, volumen
- Visualizador animado estilo WMP

### Páginas de Proyecto
- Estructura modular: principal, texto1, audios, texto2, galería, créditos
- Renderizado dinámico según contenido disponible
- Soporte para video e imágenes como elemento principal
- Lista de audios clicables que activan el reproductor
- Galería responsive con grid adaptativo
- Footer con branding de **meowrhino.studio**

## Estructura del Proyecto

Sigue la receta de [meowrhino/JAMstack](https://github.com/meowrhino/JAMstack), en su forma de
**SPA con pre-render** (el reproductor sigue sonando al cambiar de página). Para Diego:
[GUIA.md](GUIA.md). Traspaso: [TRASPASO.md](TRASPASO.md). Si el build falla: [CLAUDE.md](CLAUDE.md).

```
diegosanmarcos/
├── data/site.json          # fuentes, modos (portfolio/personal), colores, música de fondo;
│                           #   "lists": qué proyectos salen y en qué orden (ocultos: visible: false)
├── data/                   # también colores.json, fondos, iconos, fuentes, 9slice y bgm
├── projects/<slug>/        # un proyecto: project.json + sus ficheros (fotos, audios, vídeos, .txt)
├── schema/                 # qué campos lleva cada JSON (VS Code, el build y la vista previa)
├── index.html              # la home (plantilla del build, y la vista previa con Live Server)
├── proyecto.html           # la plantilla de cada /p/<slug>/
├── 404.html                # la de las direcciones que no existen
├── build/build.mjs         # → dist/: la home y una página por proyecto, con su contenido dentro
├── app.js                  # entrada: carga los datos (js/house.js), idioma y router
├── js/house.js             # la forma de la casa → la del data.json de antes (la usan app.js y el build)
├── js/validar.js           # el JSON Schema sin dependencias (de JAMstack)
├── js/                     # state, helpers, router, menu, home, project (como antes)
├── shared.js, player*.js, seo-shared.js, vendor/   # router, reproductor, SEO, butterchurn
└── scripts/vendor-update.sh  # actualiza butterchurn en vendor/
```

## Cómo funciona

- **El build** (`npm ci && node build/build.mjs`) escribe la home y `/p/<slug>/` con su title,
  description, og:image (1200×630, **sharp**, en `.cache/`), canonical y el contenido en español
  dentro (título, textos, galería, créditos). Al cargar, el JS vuelve a pintar lo mismo. Sustituye
  a los scripts que se ejecutaban a mano y a `p/` commiteado.
- **El idioma** (es/en/fr) sigue en `localStorage`, como siempre: no hay una dirección por idioma.
- **Ocultos**: `{ "project": "x", "visible": false }` en `lists`: su página con `noindex`, fuera de
  la home y del sitemap.
- **Vista previa**: Live Server sobre la carpeta. Sin `data-built` en `<html>`, `app.js` revisa los
  JSON con `schema/` y enseña en pantalla lo que pararía el build.
- **Publicar**: las dos copias en **GitHub Pages** con la Action (`.github/workflows/deploy.yml`):
  hay audios de más de 25 MB, que Cloudflare no publica. En `meowrhino`, github.io sin indexar; en
  la de Diego, su dominio. Si falla, un issue.

## Tecnologías

- **HTML5** puro
- **CSS3** con efectos glassy (backdrop-filter)
- **JavaScript** vanilla (sin frameworks)
- **API de Audio HTML5** para el reproductor

## Tipos de Proyecto y Colores

| Tipo | Color | Icono |
|------|-------|-------|
| audiovisual | DodgerBlue | Pantalla/trapecio |
| identidadSonora | MediumPurple | Onda en marco |
| audioInmersivo | Teal | Círculos concéntricos |
| musicaMezcla | Coral | Onda sinusoidal |
| miMusica | HotPink | Nota musical |
| textos | Gold | Líneas de texto |
| about | MediumSeaGreen | Perfil de usuario |

## Categorías

### Portfolio
- audiovisual
- identidadSonora
- audioInmersivo
- musicaMezcla
- about

### Personal
- miMusica
- textos

## Uso

Añadir o cambiar un proyecto, los colores (`typeColors` en `data/site.json`) o los fondos: ver
[GUIA.md](GUIA.md). En corto: copiar una carpeta de `projects/`, cambiar su `project.json` y
añadirla a `lists` en `data/site.json`.

## Navegación

- **Home**: Muestra todos los proyectos según el modo activo (portfolio/personal)
- **Click en proyecto**: Navega a `p/[slug]/` (página generada con URL bonita)
- **Click en audio**: Activa el reproductor persistente con la playlist del proyecto
- **Botón volver**: Regresa a la home desde cualquier página de proyecto

## Diseño Responsive

- Grid adaptativo en la home
- Galería responsive en páginas de proyecto
- Reproductor optimizado para móviles
- Navegación táctil amigable

## Créditos

- **Diseño y desarrollo**: [meowrhino.studio](https://meowrhino.studio)
- **Contenido**: Diego San Marcos
- **Inspiración visual**: Windows 10 UI + Windows Media Player

## Próximas Mejoras

- Página especial para "textos" con scroll largo
- Lightbox para galería de imágenes
- Navegación entre proyectos (anterior/siguiente)
- Optimización de carga de assets
- Meta tags para SEO y redes sociales
- Integración del generador de fondos animados

---

**Versión**: 1.0 - Primera Iteración  
**Fecha**: Febrero 2026
