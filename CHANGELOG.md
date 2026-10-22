# Changelog

## 0.1.1

- Fix: the covers show up. doramasyt.com keeps its images behind Cloudflare, which answers 403 to the HTTP client Kino loads images
  with, and a plugin cannot send headers with an image. The art now comes from TMDB, found by title (Kino brings its own key, no
  host to declare): a poster, year and rating on every card, and the poster and background on the show's page. Each answer is kept
  for 30 days; a call asks TMDB for at most 24 new titles, so the first Home has 8 covers a row and the next loads fill in the rest.
  / Arreglo: ahora salen las carátulas. El sitio bloquea las imágenes para el cliente de Kino; el arte sale de TMDB por título, con caché
  de 30 días y hasta 24 títulos nuevos por carga.

## 0.1.0

- First version: Home rows (en emisión, doramas, películas), search, episodes and playback from doramasyt.com, with the servers
  Mp4Upload, LuluVdo, StreamTape and MixDrop; the other servers of an episode are left out until they have an extractor.
  / Primera versión: filas de Inicio, búsqueda, capítulos y reproducción de doramasyt.com con Mp4Upload, LuluVdo, StreamTape y MixDrop.
