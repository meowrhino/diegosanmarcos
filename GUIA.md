# Guía de la web

> **Regla de oro: solo se tocan `data/` y `projects/`.** Lo demás es el código.

## Qué hay

```
data/site.json             el nombre, el dominio, las fuentes, los dos modos, los colores,
                           la música de fondo y qué proyectos salen, en qué orden
data/                      también los fondos, los iconos, las fuentes y la música de fondo
projects/<nombre>/         un proyecto, una carpeta:
  project.json               sus textos y qué ficheros usa
  PORTADA.webp, tema.mp3…    sus fotos, audios y vídeos, cada uno con su nombre
```

El **nombre de la carpeta** es también el de la dirección: `projects/feel/` →
`diegosanmarcos.com/p/feel/`. Letras sin acentos, números, guiones. Mejor no cambiarlo
una vez publicado: rompería los enlaces que ya circulan.

## La primera vez: preparar VS Code

Solo se hace una vez.

1. En VS Code: **Archivo → Nueva ventana** y, en la bienvenida, **Clonar repositorio Git…** →
   **Clonar desde GitHub**. Entra con tu cuenta, elige tu repositorio y una carpeta.
2. Al abrirla, VS Code propone instalar **Live Server** (abajo a la derecha): **Instalar**.
3. Abajo a la derecha sale **Go Live**: es la vista previa.

**VS Code te ayuda con los campos**: si pasas el ratón por encima de uno (`"title"`, `"audio"`…)
te dice qué es, y si escribes uno mal o pones algo que no toca, lo subraya en rojo. Para ver
qué campos puedes poner, dentro de las llaves pulsa **Ctrl+Espacio**. Lo sabe por la primera
línea de cada JSON (`"$schema": …`): **no la borres**.

## Añadir un proyecto, paso a paso

1. **Copia una carpeta** de `projects/` que se parezca y ponle el nombre nuevo:
   `projects/lotura/` → `projects/nuevo/`. Borra sus ficheros y deja el `project.json`.
2. **Los ficheros**: las fotos, en `.webp` con [imgToWeb](https://meowrhino.github.io/imgToWeb/)
   (**en Chrome o Firefox**; Safari no sabe hacer `.webp`); los audios en `.mp3`; los vídeos en
   `.webm` con [videoToWeb](https://meowrhino.github.io/videoToWeb/). Cada uno con su nombre.
3. **Los textos**: abre `project.json` y cambia lo que toque (los campos, abajo). Los ficheros
   se nombran tal cual se llaman, con su extensión: `"PORTADA.webp"`, `"tema.mp3"`.
4. **En la web**: en `data/site.json`, añade el nombre de la carpeta a la lista, en el sitio
   donde quieras que salga.
5. **Go Live** para verlo, y después **Subir los cambios**.

**Esconder un proyecto** (que tenga su página para mandarla, pero que no salga en la home ni
en Google): en la lista de `data/site.json`, en vez de `"nombre"`, pon
`{ "project": "nombre", "visible": false }`. Para quitarlo del todo, bórralo de la lista.

## Los campos de un proyecto (`project.json`)

| campo | qué hace |
|---|---|
| `title` | el título completo: en la página del proyecto y en Google |
| `short` | el título corto, en el cuadrado de la home |
| `type` | el tipo: `audiovisual`, `identidadSonora`, `audioInmersivo`, `musicaMezcla`, `miMusica`, `textos` o `about`. Decide el color, el icono y si sale en portfolio o en personal |
| `showImage` | `true`: en la home sale su imagen en el cuadrado |
| `main` | lo de arriba de la página: un vídeo de YouTube (`"https://youtu.be/…"`) o un fichero de la carpeta (`"video.webm"`). Puede ir vacío: `[]` |
| `text` | el primer texto, una lista de párrafos por idioma: `{ "es": [...], "en": [...], "fr": [...] }`. Si falta un idioma, sale el español |
| `audio` | los audios de la carpeta, en el orden del reproductor: `["intro.mp3", "tema.mp3"]` |
| `text2` | el segundo texto, debajo de los audios, como `text` |
| `photos` | las fotos de la galería: `["PORTADA.webp", "FOTO.webp"]` |
| `credits` | los créditos, una línea por cosa, por idioma |
| `textFiles` | *opcional*: textos en `.txt` de la carpeta, que salen enteros |

En `text` y `text2` se puede poner `<em>cursiva</em>`, `<strong>negrita</strong>` o
`<a href='https://…'>un enlace</a>` (con comillas simples).

## Verlo antes de subirlo

**Go Live** abajo a la derecha de VS Code. Se abre la web en el navegador y se refresca sola
cada vez que guardas. Si hay algo que no se publicaría (una coma, un campo mal escrito), sale
en pantalla, y dice dónde.

## Subir los cambios

1. Pestaña **Control de código fuente** (las tres bolitas unidas, a la izquierda).
2. Escribe qué has hecho (`proyecto nuevo: nuevo`) y **Confirmar** (*Commit*). Si pregunta si
   quieres añadir todos los cambios: **Sí**.
3. **Sincronizar cambios** (*Sync*).
4. En un par de minutos está en la web. En GitHub, al lado del último cambio sale una bolita:
   amarilla es que se está publicando, verde que ya está, roja que algo no cuadra.

**Antes de empezar a tocar**, dale también a **Sincronizar**, para bajar lo que haya cambiado.

**Los ficheros grandes**: GitHub no acepta ninguno de más de 100 MB. Un vídeo largo, mejor en
YouTube y su enlace en `main`.

## Qué sale en Google y al compartir

| dónde | de dónde sale |
|---|---|
| el título | `title` del proyecto, y el nombre de la web |
| el texto de debajo, en Google | la primera línea de los créditos (o del texto) |
| la imagen al compartir el enlace | la primera imagen de `main`, o si no la primera de `photos` |

## Si sale en rojo

La web no se rompe: se queda como estaba hasta que se arregla. Pincha la bolita roja, luego
**Details**, y lee el último mensaje, que dice el fichero y qué pasa:

- **"no es un JSON válido, línea 12"** → casi siempre **una coma**: que falta entre dos cosas,
  o que sobra después de la última. O unas comillas sin cerrar.
- **"\"creditos\" no es un campo de aquí (¿mal escrito?). Los que hay: title, short…"** →
  un campo mal escrito: cópialo de la lista que sale en el mensaje.
- **"\"audio\" dice \"tema.mp3\", y no está en projects/nuevo/"** → el nombre del fichero no
  es igual (mayúsculas, espacios, la extensión) o no se ha subido.
- **"\"lists\" dice \"nuevo\", y no hay ningún projects/nuevo/project.json"** → el nombre de
  la lista y el de la carpeta no son iguales.
