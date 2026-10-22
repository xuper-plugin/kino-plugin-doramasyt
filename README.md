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

- **Inicio** con tres filas: *En emisión*, *Doramas* y *Películas* (cada una con «Ver más» y páginas).
- **Búsqueda** por título y **ficha** con sinopsis, géneros, póster y la lista de capítulos.
- **Reproducción** con cuatro servidores: Mp4Upload, LuluVdo, StreamTape y MixDrop. Kino abre el mejor y deja los demás en el
  menú **Servidor**. El sitio ofrece otros (Mega, Filemoon, VOE, DoodStream…) que no se abren desde aquí: necesitan el navegador
  oculto o piden verificación humana.
- Si el título tiene «Latino» o «Castellano» en su nombre en el sitio, la copia se marca así; si no, «Subtitulado».

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
