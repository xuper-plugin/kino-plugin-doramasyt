# Changelog

## 0.2.0

- Uses more of Kino's plugin API: a **section of its own** ("Doramas", with four tabs -- novedades, doramas, películas, géneros -- and a
  hero that borrows TMDB's background and synopsis), **categories** (the site's twelve genres, each a paged list), a **page of its
  own for a movie** (`details`: synopsis, genres, year, length, score and background), a **settings form** (show only dubbed or only
  subtitled titles, switch the TMDB covers off, clear the cache), a violet **theme**, the **download** capability, and a "Capítulos
  nuevos" row when at least three shows have a new episode. Needs Kino 0.9.55 (apiVersion 9).
  / Aprovecha más la API de Kino: sección propia con cuatro pestañas y héroe, categorías por género, ficha propia de las películas,
  ajustes (solo doblados o subtitulados, carátulas de TMDB, vaciar caché), tema violeta, descargas y fila de capítulos nuevos.

## 0.1.4

- Fix: the English title of a Korean drama no longer takes the cover of a remake that shares the name (TMDB names the original in Spanish); an Asian original near the top of the results wins over an exact name from another country.
  / Arreglo: el título en inglés de un dorama coreano ya no toma la carátula de un remake con el mismo nombre.

## 0.1.3

- Fix: two shows with one name (a Korean drama and its remake) no longer swap covers: the Korean, Japanese, Chinese or Thai original is preferred. Covers found by the earlier matching are looked up again.
  / Arreglo: dos series con el mismo nombre (un dorama coreano y su remake) ya no intercambian carátula; se prefiere el original asiático.

## 0.1.2

- The art lookup now says in the log what it did (how many titles, whether kino.tmdb exists, how many got a poster), to find out why a device shows no covers.
  / La búsqueda de carátulas deja en el registro lo que hizo.

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
