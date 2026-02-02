# Proceso de Desarrollo - Diego San Marcos Portfolio

## 2026-02-02 07:42 - Inicio del Proyecto y Reorganización

### Sinopsis
Inicio del desarrollo de la web portfolio/personal de Diego San Marcos, inspirada en las interfaces de Windows 10 con estética glassy. Se ha clonado el repositorio, analizado la estructura existente y reorganizado los archivos de prueba.

### Fase Inicial - Material Preexistente

El repositorio ya contenía:
- **Generador de fondos**: Dos versiones de prueba (una reactiva al audio, otra estática)
  - `app.js` - Lógica del generador
  - `index.html` - Versión sin reacción al audio
  - `test.html` - Versión reactiva al audio
  - `styles.css` - Estilos del generador
- **Estructura de datos**: `data/data.json` con proyectos y categorías
- **Assets existentes**:
  - 3 iconos: audiovisual, musicaMezcla, audioInmersivo
  - 2 fondos: fondo1.jpg (portfolio) y fondo2.jpeg (personal)
  - Carpetas de proyectos con contenido multimedia

### Proceso Realizado

#### 1. Clonación y Análisis
- Clonado el repositorio `meowrhino/diegosanmarcos`
- Clonado el repositorio `meowrhino/andreacarilla` como referencia de organización
- Analizado la estructura de datos en `data.json`
- Revisado los iconos existentes para entender el estilo visual

#### 2. Reorganización de Archivos
Se han movido los archivos de prueba del generador de fondos a una carpeta dedicada:
```
generadorFondos/
├── app.js
├── index.html
├── styles.css
└── test.html
```

**Motivo**: Conservar las pruebas de generador de fondos para uso futuro, manteniendo el "ambience" de las animaciones que se integrarán eventualmente.

#### 3. Observaciones de Diseño

**Iconos existentes** (estilo minimalista geométrico):
- audiovisual: Trapecio/pantalla
- musicaMezcla: Onda sinusoidal
- audioInmersivo: Círculos concéntricos
- Todos en negro sólido, formas simples y limpias

**Estructura de datos actual**:
- Categorías portfolio: audiovisual, identidadSonora, audioInmersivo, musicaMezcla
- Categorías personal: miMusica, textos
- Categoría especial: about
- Cada proyecto tiene: slug, titulo, tipo, principal, texto1, audio, texto2, galeria, creditos

**Inspiración de andreacarilla**:
- Estructura modular con componentes JS
- Sistema de navegación por categorías
- Galería dinámica generada desde JSON

### Próximos Pasos

1. Crear `colores.json` con la paleta de colores HTML proporcionada
2. Actualizar `data.json` con:
   - Array de colores asignados a cada tipo
   - Reorganización de categorías (about dentro de portfolio)
3. Generar iconos faltantes: identidadSonora, textos, about, miMusica
4. Desarrollar estructura HTML/CSS/JS de la home con cuadrados estilo Windows 10
5. Implementar reproductor persistente estilo Windows Media Player

### Decisiones de Diseño

- **Paleta de colores**: Solo colores con nombre HTML (proporcionados por el usuario)
- **Fondos**: fondo1.jpg para portfolio, fondo2.jpeg para personal
- **Transiciones**: Suaves en toda la web
- **Switch**: Abajo a la derecha, portfolio por defecto
- **Reproductor**: Persistente, estilo Windows Media Player XP/Vista, se mantiene al navegar


## 2026-02-02 07:45 - Creación de Colores y Generación de Iconos

### Sinopsis
Se ha creado el archivo `colores.json` con toda la paleta de colores HTML proporcionada por el usuario. Se ha actualizado `data.json` con las categorías reorganizadas y un array de colores asignados a cada tipo de proyecto. Se han generado los cuatro iconos faltantes siguiendo el estilo minimalista y geométrico de los existentes.

### Proceso Realizado

#### 1. Creación de colores.json
Se ha creado un archivo JSON con todos los colores HTML y sus códigos hexadecimales. Este archivo servirá como referencia para el uso de colores en toda la web. La paleta incluye 155 colores organizados por familias cromáticas.

#### 2. Actualización de data.json
Se han realizado las siguientes modificaciones en la estructura de datos:

**Reorganización de categorías**: La categoría "about" ahora forma parte de "portfolio" en lugar de ser una categoría independiente. Esto permite que la biografía aparezca junto con los proyectos profesionales en el switch de portfolio.

**Nuevo array typeColors**: Se ha añadido un objeto que asigna un color específico a cada tipo de proyecto. Los colores seleccionados son vibrantes y diferenciados entre sí para facilitar la identificación visual. La asignación es la siguiente:

- audiovisual → DodgerBlue (azul vibrante, evoca pantallas y medios audiovisuales)
- identidadSonora → MediumPurple (púrpura, asociado con creatividad y marca)
- audioInmersivo → Teal (verde azulado, sugiere inmersión y profundidad)
- musicaMezcla → Coral (coral cálido, energético y musical)
- miMusica → HotPink (rosa intenso, personal y expresivo)
- textos → Gold (dorado, clásico y literario)
- about → MediumSeaGreen (verde marino, natural y personal)

#### 3. Generación de Iconos
Se han generado cuatro iconos nuevos siguiendo el estilo minimalista y geométrico de los iconos existentes. Todos los iconos son en negro sólido sobre fondo transparente, con formas simples y líneas gruesas.

**identidadSonora**: Onda de audio contenida en un marco cuadrado, representando una marca sonora o logo audio. La forma de onda está estilizada y el marco sugiere identidad corporativa.

**textos**: Tres líneas horizontales de diferentes longitudes apiladas verticalmente, representando líneas de texto o un documento. Es el símbolo universal de contenido escrito.

**about**: Silueta de perfil de persona dentro de un círculo, representando información personal o biografía. Es el icono estándar de usuario/perfil.

**miMusica**: Nota musical (corchea) con trazo grueso y forma limpia, representando composición musical personal. Símbolo directo y reconocible de música.

Todos los iconos mantienen coherencia visual con los tres existentes (audiovisual, musicaMezcla, audioInmersivo) y son fácilmente reconocibles a tamaño pequeño, lo cual es crucial para su uso en los cuadrados de la interfaz.

### Próximos Pasos
Con los datos estructurados y los assets visuales completos, el siguiente paso es desarrollar la estructura HTML, CSS y JavaScript de la página home. Esta incluirá los cuadrados grandes estilo Windows 10, el sistema de switch entre portfolio y personal, y las transiciones suaves entre secciones.


## 2026-02-02 07:52 - Implementación de Páginas de Proyecto

### Sinopsis
Se ha completado la implementación de la plantilla de páginas individuales de proyecto con la estructura completa: principal, texto1, audios, texto2, galería y créditos. El reproductor de audio persistente funciona correctamente también en las páginas de proyecto, manteniendo la experiencia de usuario fluida al navegar entre páginas.

### Archivos Creados

**proyecto.html**: Plantilla HTML para páginas individuales de proyecto. Incluye header con navegación, secciones para cada tipo de contenido, footer con branding de meowrhino.studio, y el reproductor de audio persistente.

**proyecto.css**: Estilos específicos para páginas de proyecto. Incluye diseño glassy coherente con la home, animaciones de fade-in para cada sección, estilos para lista de audios, galería grid responsive, y footer fijo con atribución.

**proyecto.js**: Lógica para cargar y renderizar proyectos individuales. Lee el parámetro de URL `?proyecto=slug`, carga los datos del proyecto desde data.json, renderiza cada sección según el contenido disponible, y gestiona el reproductor de audio con la misma funcionalidad que en la home.

### Funcionalidades Implementadas

**Sistema de Navegación**: Los clicks en los cuadrados de la home ahora navegan a `proyecto.html?proyecto=slug`. El botón "volver" en el header de proyecto regresa a la home. El fondo se mantiene coherente según si el proyecto es de portfolio o personal.

**Renderizado Dinámico**: Cada sección se renderiza solo si tiene contenido en el data.json. Las secciones vacías se ocultan automáticamente. El contenido principal puede ser video o imagen, detectado por extensión de archivo. Los textos soportan HTML para enlaces y formato.

**Lista de Audios**: Los audios se muestran como items clicables con icono musical. Al hacer clic en un audio, se activa el reproductor persistente. El reproductor carga todos los audios del proyecto en la playlist. La reproducción es automática y en bucle.

**Galería de Imágenes**: Grid responsive que se adapta al tamaño de pantalla. Las imágenes mantienen aspect ratio 1:1. Efecto hover con scale para mejor interacción. Manejo de errores para probar diferentes extensiones de imagen.

**Footer con Branding**: Footer fijo en la parte inferior con atribución a meowrhino.studio. Diseño coherente con el resto de la web usando efectos glassy. Enlace funcional al sitio del estudio.

### Pruebas Realizadas

Se han probado tres proyectos diferentes para verificar el correcto funcionamiento de la plantilla. El proyecto MDE muestra correctamente el video principal, texto y créditos. El proyecto about (BIO) renderiza los tres párrafos de biografía y el email de contacto como enlace. El proyecto Purnima muestra la lista de tres audios clicables y el reproductor se activa correctamente.

### Características Destacadas

**Persistencia del Reproductor**: El reproductor de audio se mantiene visible y funcional al navegar entre la home y las páginas de proyecto. La playlist se actualiza al hacer clic en audios de diferentes proyectos. Los controles funcionan correctamente en todas las páginas.

**Animaciones Suaves**: Cada sección tiene una animación de fade-in con delay escalonado. Las transiciones entre páginas son fluidas. Los efectos hover en elementos interactivos son sutiles y profesionales.

**Diseño Coherente**: El estilo glassy se mantiene en todas las páginas. Los fondos dinámicos cambian según portfolio/personal. La tipografía y espaciado son consistentes en toda la web.

### Estado Actual del Proyecto

La estructura base de la web está completa y funcional. La home con cuadrados y switch funciona perfectamente. Las páginas de proyecto renderizan todo el contenido correctamente. El reproductor persistente funciona en todas las páginas. El branding de meowrhino.studio está presente en todas las páginas de proyecto.

### Pendiente para Próxima Iteración

Crear página especial para "textos" con scroll largo. Añadir más proyectos al data.json con contenido completo. Optimizar carga de imágenes y videos. Añadir lightbox para galería de imágenes. Implementar navegación entre proyectos (anterior/siguiente). Añadir meta tags para SEO y compartir en redes sociales.
