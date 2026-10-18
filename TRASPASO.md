# Traspaso: la versión nueva a la copia de Diego

Diego ya tiene su copia, `diegosanmarcos/web`, que publica `diegosanmarcos.com`
con GitHub Pages (*legacy*: sirve los ficheros de `main` tal cual), y **la edita
él**: 50 commits suyos hasta el 2026-10-18. Es la versión de antes (un
`data/data.json`, las páginas de `p/` hechas a mano con un script): cada
proyecto tiene sus meta, pero el contenido lo pinta el JS y Google lo ve vacío.

**Su contenido viene de su copia** (traído el 2026-10-18: 20 proyectos, con
BIFSC2). Lo que haya cambiado desde entonces hay que traerlo antes.

**Las dos copias publican en GitHub Pages, no en Cloudflare**: hay audios de
más de 25 MB (los de *feel*), que Workers no publica. La Action corre en las dos
y el build decide por el dueño del repo: en `meowrhino`, github.io sin indexar;
en la de Diego, la raíz con el `url` de `site.json`.

Tiempo: unos 20 minutos, y un rato con él: **cambia cómo edita** (de un
`data.json` a una carpeta por proyecto). Hablarlo antes.

## Antes

- [ ] `main` de meowrhino al día y sin cambios a medias (`git status` limpio).
- [ ] ¿Ha tocado algo Diego desde el 2026-10-18?
      `gh api repos/diegosanmarcos/web/commits --jq '.[0:3][].commit.message'`. Si sí, pasar sus
      cambios aquí antes (`data/data.json` → `projects/<nombre>/project.json` y `data/site.json`;
      cómo, en JAMstack, `patrones.md` §3b).

## 1. Diego cambia cómo publica su repo

Solo él puede (hace falta ser admin; nosotros tenemos permiso de escribir):

- [ ] En `diegosanmarcos/web`: **Settings → Pages → Source: GitHub Actions**. El dominio
      (`diegosanmarcos.com`) se queda como está.

## 2. La versión nueva a su `main`

Las dos copias no comparten historia (su repo tiene la suya). Se guarda la de antes en una
rama y se sube la nueva encima:

- [ ] `git push https://github.com/diegosanmarcos/web.git <sha-de-su-main>:refs/heads/antes`
- [ ] `git push --force-with-lease=main:<sha-de-su-main> https://github.com/diegosanmarcos/web.git main`
- [ ] En su repo, pestaña **Actions**: la de `build & deploy` en verde.

## 3. Comprobar en su dominio

- [ ] La home (los cuadrados, el cambio portfolio/personal, la música de fondo), un proyecto con
      audios (`/p/robie/`: el reproductor sigue al cambiar de página) y uno con vídeo (`/p/alexander/`).
- [ ] `view-source:` de un proyecto: el título, los textos y los créditos están en el HTML; el
      `canonical` con su dominio, y **sin** `noindex` (salvo los ocultos).
- [ ] `/robots.txt` dice `Allow` y `/sitemap.xml` tiene sus direcciones.
- [ ] Compartir un proyecto por WhatsApp: sale su imagen (la og).

## 4. Search Console, con su cuenta de Google

- [ ] Dar de alta el dominio y enviar `sitemap.xml`.

## 5. Diego en su ordenador

Con él delante, siguiendo [GUIA.md](GUIA.md):

- [ ] **Sincronizar**: la estructura cambia entera (si tenía cambios sin subir, antes).
- [ ] Live Server: **Go Live** y ve la vista previa.
- [ ] Un cambio pequeño (una coma en un crédito), Confirmar → Sincronizar, y la bolita verde.

## 6. Al acabar

- [ ] Fila de diegosanmarcos en `JAMstack/inventario.md` con las dos direcciones.
