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

```
diegosanmarcos/
├── index.html              # Página principal (home)
├── proyecto.html           # Plantilla de páginas de proyecto
├── app.js                  # Lógica de la home
├── proyecto.js             # Lógica de páginas de proyecto
├── styles.css              # Estilos globales y de la home
├── proyecto.css            # Estilos específicos de páginas de proyecto
├── data/
│   ├── data.json          # Datos de proyectos y categorías
│   ├── colores.json       # Paleta de colores HTML
│   ├── backgrounds/       # Fondos para portfolio y personal
│   ├── icons/             # Iconos de cada tipo de proyecto
│   └── projects/          # Carpetas de cada proyecto con sus assets
├── generadorFondos/       # Experimentos de generador de fondos
└── manus/                 # Documentación del proceso
```

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

### Añadir un Nuevo Proyecto

1. Crear carpeta en `data/projects/[slug]/`
2. Añadir assets (videos, imágenes, audios)
3. Actualizar `data/data.json` con la información del proyecto:

```json
{
  "slug": "nombre-proyecto",
  "titulo": "Título del Proyecto",
  "tipo": "audiovisual",
  "principal": ["video.mp4"],
  "texto1": ["Descripción del proyecto"],
  "audio": ["audio1.wav", "audio2.wav"],
  "texto2": ["Más información"],
  "galeria": ["imagen1", "imagen2"],
  "creditos": ["Crédito 1", "Crédito 2"]
}
```

### Cambiar Colores

Editar `data/data.json` en la sección `typeColors` usando nombres de colores HTML del archivo `data/colores.json`.

### Personalizar Fondos

Reemplazar `data/backgrounds/fondo1.jpg` (portfolio) y `data/backgrounds/fondo2.jpeg` (personal).

## Navegación

- **Home**: Muestra todos los proyectos según el modo activo (portfolio/personal)
- **Click en proyecto**: Navega a `proyecto.html?proyecto=[slug]`
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
