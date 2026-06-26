# Handoff: Board Game Picker — BGG Data Enrichment

## Context

Eze and his sister Eli have a shared board game collection (~80 games) tracked in a Google Sheet. We built an interactive web picker (`juegos.html`) that reads from the sheet via CSV and lets them filter by player count, owner, and category. The next session focuses on enriching the app with live data from the BoardGameGeek (BGG) API.

---

## What's already done

### Google Sheet
- URL: `https://docs.google.com/spreadsheets/d/1nw3LLBVFaYE_tMb5wmzL-Bu_I7FJYt4JFQkJuMQLjyA/edit`
- Columns: **Juego, Dueño, Categoría, Best for, BGG_ID**
- BGG IDs have been filled in for all ~80 games (2 games have no BGG entry: *Basta!* and *Destapados*)
- ~10 games still have empty Categoría and Best for columns

### Web app — `juegos.html`
- Saved to the user's outputs folder
- Fetches the sheet as CSV via the published URL: `https://docs.google.com/spreadsheets/d/{SHEET_ID}/pub?output=csv`
- Sheet ID: `1nw3LLBVFaYE_tMb5wmzL-Bu_I7FJYt4JFQkJuMQLjyA`
- Current filters: player count (number input), owner (Eze/Eli/Todos), category (Party / Estrategia / Cartas / Coop / Abstracto)
- "Sorprendeme" random picker button
- Intended to be hosted on GitHub Pages as `index.html`

---

## Plan for this session

Enrich the existing `juegos.html` with BGG API data. The user confirmed they want all of the following:

### 1. BGG API integration
The BGG XML API v2 is public and requires no auth key.

- **Thing endpoint** (fetches details for one or more games by ID):
  `https://boardgamegeek.com/xmlapi2/thing?id=230802,163412,13&stats=1`
  - Returns: name, thumbnail image URL, `yearpublished`, `minplaytime`, `maxplaytime`, mechanics (as `<link type="boardgamemechanic">`), and with `stats=1`: `averageweight` (complexity 1–5), `average` (community rating)
- Batch up to ~20 IDs per request to avoid rate limits
- Cache the fetched data in `localStorage` with a TTL (e.g., 7 days) so subsequent page loads are instant and don't hammer BGG

### 2. Enriched game cards
Each card should display:
- **Box art thumbnail** (from BGG `<thumbnail>` element) — makes the picker visual
- **BGG rating** (e.g., ★ 7.8)
- **Complexity badge** (BGG `averageweight`, rounded to 1 decimal, labeled 1–5)
- **Playtime** (e.g., 30–60 min)

### 3. New filters to add
- **Complexity**: chips — Liviano (≤2), Medio (2–3.5), Complejo (>3.5)
- **Tiempo disponible**: chips — <30 min, 30–60 min, 60+ min
- **Modo**: chips — Cooperativo, Competitivo (detect from mechanics or category keywords)

### 4. Mechanics filter (stretch)
BGG returns official mechanics (e.g., "Deck Building", "Cooperative Game", "Worker Placement"). These can replace/supplement the current keyword-based category matching for more accurate filtering.

---

## Implementation notes

### Fetching BGG data
BGG XML API has CORS headers that allow browser fetches. Parse the XML response with `DOMParser`.

Example fetch + parse skeleton:
```js
async function fetchBGGData(ids) {
  const url = `https://boardgamegeek.com/xmlapi2/thing?id=${ids.join(',')}&stats=1`;
  const resp = await fetch(url);
  const text = await resp.text();
  const xml  = new DOMParser().parseFromString(text, 'text/xml');
  return Array.from(xml.querySelectorAll('item')).map(item => ({
    id:         item.getAttribute('id'),
    thumbnail:  item.querySelector('thumbnail')?.textContent,
    mintime:    item.querySelector('minplaytime')?.getAttribute('value'),
    maxtime:    item.querySelector('maxplaytime')?.getAttribute('value'),
    rating:     item.querySelector('statistics ratings average')?.getAttribute('value'),
    weight:     item.querySelector('statistics ratings averageweight')?.getAttribute('value'),
    mechanics:  Array.from(item.querySelectorAll('link[type="boardgamemechanic"]')).map(l => l.getAttribute('value')),
  }));
}
```

### localStorage cache
```js
const CACHE_KEY = 'bgg_cache';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

function getCached() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data; // { [bggId]: { thumbnail, rating, weight, mintime, maxtime, mechanics } }
  } catch { return null; }
}
```

### Cooperative detection
A game is cooperative if:
- BGG mechanic includes "Cooperative Game"
- OR category string includes "coop" (already in the sheet)

### BGG IDs with no entry
Games where `BGG_ID` is blank in the sheet (*Basta!*, *Destapados*, and ~10 incomplete rows): show card normally but skip BGG enrichment for those.

---

## File locations

| File | Path |
|---|---|
| Web app | `outputs/juegos.html` (in the user's Cowork outputs folder) |
| This handoff | `outputs/handoff-juegos-bgg.md` |

---

## Suggested skills

- **`anthropic-skills:xlsx`** — if the user wants to export the enriched game data back to a spreadsheet
- **`anthropic-skills:pptx`** — if the user later wants a "collection overview" presentation
- No specialized skill needed for the HTML work — implement directly using Read/Edit/Write tools

---

## User preferences

- Language: Spanish (responses and UI text in Spanish)
- Tone: concise, direct
- The app UI is in Spanish (e.g., "Sorprendeme", "Jugadores", "Dueño")
- Owner names in the data are "Eze" and "Eli" exactly (case-sensitive)
- Hosting target: GitHub Pages (`index.html`)
