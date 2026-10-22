# DoramasYT para Kino

Plugin de [Kino](https://github.com/kinotvapp/kino-light) para ver **doramas asiáticos** (coreanos, japoneses, chinos…) en español de
[doramasyt.com](https://www.doramasyt.com/): latino, castellano o subtitulados.

> Plugin no oficial. El catálogo y los videos pertenecen a doramasyt.com y a los servidores donde están alojados; este plugin solo los
> lista y abre dentro de Kino.

## Instalar

En Kino: **Ajustes ▸ Plugins ▸ Agregar**, y pega:

```
xuper-plugin/kino-plugin-doramasyt
```

## Qué trae

- **Una sección propia** («Doramas», en Inicio en el teléfono y en la barra lateral en la TV) con cuatro pestañas: *Novedades*, *Doramas*,
  *Películas* y *Géneros*, y un destacado con el fondo y la sinopsis de TMDB.
- **Inicio** con las filas *En emisión*, *Doramas* y *Películas* (cada una con «Ver más» y páginas), y *Capítulos nuevos* cuando
  hay al menos tres series con uno.
- **Categorías**: los doce géneros del sitio (K-Drama, J-Drama, C-Drama, Thai-Drama, Romance, Comedia, Drama, Acción, Misterio,
  Fantasía, Histórico y Escolar), cada uno con su lista por páginas.
- **Búsqueda** por título y **ficha** con sinopsis, géneros, póster y la lista de capítulos; las películas tienen ficha propia con año,
  duración, nota y fondo.
- **Reproducción** con cuatro servidores: Mp4Upload, LuluVdo, StreamTape y MixDrop. Kino abre el mejor y deja los demás en el menú
  **Servidor**. El sitio ofrece otros (Mega, Filemoon, VOE, DoodStream…) que no se abren desde aquí: necesitan el navegador oculto o
  piden verificación humana. También se puede **descargar**.
- **Ajustes ▸ DoramasYT**: mostrar todo, solo doblados (latino o castellano) o solo subtitulados; apagar las carátulas de TMDB; vaciar la caché.
- Si el título tiene «Latino» o «Castellano» en su nombre en el sitio, la copia se marca así; si no, «Subtitulado».

## Carátulas

El sitio protege sus imágenes con Cloudflare y Kino no puede cargarlas, así que las carátulas, el año y la nota salen de TMDB, buscando por
título. Las primeras veces algunas tarjetas pueden salir sin carátula: cada carga pide a TMDB hasta 24 títulos nuevos y guarda la
respuesta (30 días), y las siguientes completan el resto. Un dorama que TMDB no conoce se queda sin carátula.

## Límites

- Una serie con más de 50 capítulos puede mostrar solo los primeros: el sitio los reparte por páginas y aún no se piden las siguientes.
- Las películas son el «capítulo 0» del sitio; se abren desde la fila *Películas*.

## Desarrollo

```
npm test            # pruebas sin red
npm run validate    # compila plugin.js y valida el manifiesto con el kit
node sdk/run.mjs ./plugin.js home
node sdk/run.mjs ./plugin.js resolve 'e:<slug>:1'
```

Licencia Apache-2.0 (ver `LICENSE` y `NOTICE`).
