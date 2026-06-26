# Plan — Integración BGG API + mejora de cards

App: `juegos.html` (picker de la colección de Eze & Eli). Lee la planilla de Google como CSV.
Objetivo: enriquecer con datos en vivo de BoardGameGeek y mejorar las cards.

---

## Parte A — Roadmap por fases

### Fase 0 — Fix previo (bloqueante)
El parser CSV actual lee solo columnas 0–3 e **ignora `BGG_ID` (columna 4)**. Sin esto nada del resto funciona.
- Agregar `bggId = cols[4]` al objeto `game`.
- Esfuerzo: ~5 min. Riesgo: nulo.

### Fase 1 — Capa de datos BGG
Traer datos de BGG y cachearlos. Invisible al usuario salvo por un loader.
- `fetchBGG(ids)`: pega a `thing?id=...&stats=1`, parsea XML con `DOMParser`.
- Batching: máx 20 IDs por request.
- Cache `localStorage` con TTL de 7 días (clave `bgg_cache_v1`).
- Merge de datos BGG en `allGames` por `bggId`.
- Render en dos pasos: primero la planilla (rápido), después re-render cuando llega BGG.
- Riesgo: rate limit / 202 de BGG, CORS. Mitigado por cache + batching + manejo de error suave.

### Fase 2 — Cards enriquecidas
- Box art (thumbnail), rating ★, badge de complejidad (1–5), tiempo de juego.
- Fallback prolijo para juegos sin `BGG_ID` (Basta!, Destapados, ~10 filas incompletas): card normal sin datos BGG.
- Riesgo: layout. Se ajusta el grid para acomodar imagen.

### Fase 3 — Filtros nuevos
- **Complejidad**: Liviano (≤2) / Medio (2–3.5) / Complejo (>3.5) — usa `averageweight`.
- **Tiempo disponible**: <30 / 30–60 / 60+ min — usa `maxplaytime`.
- **Modo**: Cooperativo / Competitivo — usa mecánicas BGG + categoría.
- Riesgo: juegos sin datos BGG quedan fuera de estos filtros salvo "Todos". Se documenta.

### Fase 4 — Mecánicas (stretch)
- Reemplazar/complementar el match por keywords con mecánicas oficiales de BGG.
- Opcional, no bloqueante.

**Orden recomendado:** 0 → 1 → 2 → 3 → (4). Cada fase deja la app funcionando.

---

## Parte B — Spec técnico

### B.1 Modelo de datos
Cada `game` pasa de:
```
{ name, owner, cat, min, max, bestForRaw }
```
a:
```
{ name, owner, cat, min, max, bestForRaw, bggId,
  bgg: { thumbnail, rating, weight, mintime, maxtime, year, mechanics[] } | null }
```

### B.2 Fetch + parse (BGG XML API v2, sin auth)
Endpoint: `https://boardgamegeek.com/xmlapi2/thing?id=ID1,ID2,...&stats=1`
Selectores por `<item>`:
- `thumbnail` → `item.querySelector('thumbnail')?.textContent`
- `mintime`   → `minplaytime[value]`
- `maxtime`   → `maxplaytime[value]`
- `rating`    → `statistics ratings average[value]`
- `weight`    → `statistics ratings averageweight[value]`
- `year`      → `yearpublished[value]`
- `mechanics` → `link[type="boardgamemechanic"][value]`

Batching: agrupar IDs en chunks de 20, `Promise.all` sobre los chunks.
Manejo HTTP 202 (BGG encolando): reintentar una vez tras ~1.5s.

### B.3 Cache localStorage
- Clave: `bgg_cache_v1`. Estructura `{ ts, data: { [bggId]: {...} } }`.
- TTL: 7 días. Si vence o falla el parse → se ignora y se vuelve a pedir.
- Solo se piden a BGG los IDs que NO estén en cache vigente (fetch incremental).

### B.4 Cards (HTML/CSS)
Estructura nueva de card:
```
[ thumbnail 16:9 o placeholder ]
nombre
categoría
badges: 👥 jugadores · dueño · ★ rating · ⚙ complejidad · ⏱ tiempo
```
- Grid: subir min-width de 175px a ~190px para la imagen.
- Thumbnail con `loading="lazy"`, `object-fit: cover`, placeholder gris si no hay.
- Badge complejidad con color por nivel (verde/amarillo/rojo).

### B.5 Filtros nuevos
Estado: `selectedComplexity`, `selectedTime`, `selectedMode` (default `all`).
- Complejidad: `w<=2` liviano, `2<w<=3.5` medio, `w>3.5` complejo.
- Tiempo: usa `maxtime`; `<30`, `30–60`, `60+`.
- Modo coop: `mechanics` incluye "Cooperative Game" OR `cat` incluye "coop".
  Competitivo: lo que no es coop.
- Juegos sin `bgg`: pasan solo cuando el filtro está en "Todos".
- Integrar al `getFiltered()` existente con AND.

### B.6 Mecánicas (stretch)
- Construir set único de mecánicas presentes en la colección.
- Chips dinámicos (o dropdown) para filtrar por mecánica oficial.

### B.7 Edge cases
- `BGG_ID` vacío → `bgg = null`, card sin enriquecer, excluido de filtros BGG salvo "Todos".
- BGG caído / timeout → app sigue andando solo con datos de planilla; loader desaparece.
- Rating/weight ausentes en BGG → no se muestra ese badge (no "★ undefined").
- Cache corrupto → try/catch, se descarta.

### B.8 Verificación
- `node --check` del JS extraído (sintaxis).
- Revisión lógica del parseo XML y del merge.
- Smoke test: card con BGG, card sin BGG, los 3 filtros nuevos, cache hit en segundo load.

---

## Archivos
- `juegos.html` — se edita in-place.
- `PLAN-bgg.md` — este plan.
