  // URL "Publicar en la web" del sheet (formato /d/e/.../pub que sí responde sin login)
  const CSV_URL  = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTUKKHxfJeS8Ih9L05KXp3URPZVcMlRt6hgyAA2ko_sO_SDWJYHv-SKfe8yfR4n2-vanxR88mUDj0Sb/pub?output=csv';

  let allGames          = [];
  let selectedOwner     = 'all';
  let selectedCat       = 'all';
  let selectedCx        = 'all';
  let selectedTime      = 'all';
  let selectedMode      = 'all';
  let selectedMechanic  = 'all';
  let searchQuery       = '';
  let highlighted       = null;

  /* ── Parse "Best for" column ── */
  function parsePlayerCount(raw) {
    if (!raw || !raw.trim()) return { min: 1, max: 99 };
    const s = raw.trim().toLowerCase().replace(/\(.*?\)/g, '').trim();
    if (s.includes('+') || s.includes('o +')) {
      const n = parseInt(s);
      return { min: isNaN(n) ? 1 : n, max: 99 };
    }
    const parts = s.split(/[-–]/);
    if (parts.length === 2) {
      const a = parseInt(parts[0]), b = parseInt(parts[1]);
      if (!isNaN(a) && !isNaN(b)) return { min: a, max: b };
    }
    const n = parseInt(s);
    return isNaN(n) ? { min: 1, max: 99 } : { min: n, max: n };
  }

  /* ── Minimal CSV parser (handles quoted fields) ── */
  function parseCSVLine(line) {
    const cols = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    cols.push(cur.trim());
    return cols;
  }

  function parseCSV(text) {
    const lines = text.replace(/\r/g, '').split('\n');
    const games = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols    = parseCSVLine(line);
      const name    = cols[0] || '';
      const owner   = (cols[1] || '').trim();
      const cat     = (cols[2] || '').trim();
      const bestFor = (cols[3] || '').trim();
      const bggId   = (cols[4] || '').trim().replace(/[^0-9]/g, ''); // solo dígitos
      if (!name) continue;
      const { min, max } = parsePlayerCount(bestFor);
      games.push({ name, owner, cat, min, max, bestForRaw: bestFor, bggId, bgg: null });
    }
    return games;
  }

  /* ───────────── BGG: snapshot estático ─────────────
     La API XML de BGG quedó cerrada (devuelve 401 hasta logueado), así que los
     datos se generan offline y se sirven desde bgg-data.json junto a esta página.
     Estructura: { [bggId]: { thumbnail, rating, weight, mintime, maxtime, year, mechanics[] } } */
  async function enrichWithBGG() {
    const statusEl = document.getElementById('bgg-status');
    try {
      const resp = await fetch('bgg-data.json');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      allGames.forEach(g => { if (g.bggId && data[g.bggId]) g.bgg = data[g.bggId]; });
      statusEl.textContent = '';
      populateMechanics();
      renderGames();
    } catch (err) {
      statusEl.textContent = '';
      console.warn('bgg-data.json no disponible:', err);
    }
  }

  /* ───────────── Clasificación BGG ───────────── */
  function cxBucket(g) {
    const w = g.bgg?.weight;
    if (w == null) return null;
    if (w <= 2)   return 'light';
    if (w <= 3.5) return 'med';
    return 'heavy';
  }

  function timeBucket(g) {
    const t = g.bgg?.maxtime;
    if (t == null || t === 0) return null;
    if (t < 30)  return 'short';
    if (t <= 60) return 'mid';
    return 'long';
  }

  function isCoop(g) {
    if (g.bgg?.mechanics?.some(m => /cooperative/i.test(m))) return true;
    return /coop/i.test(g.cat);
  }

  /* Pobla el dropdown con las mecánicas presentes en la colección (preserva selección) */
  function populateMechanics() {
    const sel = document.getElementById('mechanic-select');
    const set = new Set();
    allGames.forEach(g => g.bgg?.mechanics?.forEach(m => set.add(m)));
    const mechs = [...set].sort((a, b) => a.localeCompare(b, 'es'));
    const prev  = selectedMechanic;
    sel.innerHTML = '<option value="all">Todas</option>' +
      mechs.map(m => `<option value="${escAttr(m)}">${escHtml(m)}</option>`).join('');
    if (prev !== 'all' && mechs.includes(prev)) {
      sel.value = prev;
    } else {
      sel.value = 'all';
      selectedMechanic = 'all';
    }
    sel.toggleAttribute('data-all', selectedMechanic === 'all');
  }

  /* ── Category matching ── */
  const CAT_KEYWORDS = {
    party:      ['party', 'charlar', 'familiar', 'roles', 'preguntas', 'misterio'],
    estrategia: ['estrategia', 'deckbuilder', 'tile', 'territory', 'city', 'colocación', 'building'],
    cartas:     ['cartas', 'card'],
    coop:       ['coop'],
    abstracto:  ['abstracto'],
  };

  function catMatch(game, cat) {
    if (cat === 'all') return true;
    const gc = game.cat.toLowerCase();
    return (CAT_KEYWORDS[cat] || []).some(k => gc.includes(k));
  }

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  /* ── Filtering ── */
  function getPlayers() {
    const v = parseInt(document.getElementById('player-count').value);
    return isNaN(v) ? 1 : Math.max(1, v);
  }

  function getFiltered() {
    const p = getPlayers();
    const query = normalizeText(searchQuery.trim());
    return allGames.filter(g => {
      if (query && !normalizeText(g.name).includes(query)) return false;
      if (!(g.min <= p && g.max >= p)) return false;
      if (selectedOwner !== 'all' && g.owner !== selectedOwner) return false;
      if (!catMatch(g, selectedCat)) return false;
      // filtros BGG: si no hay dato, solo pasan cuando el filtro está en "all"
      if (selectedCx   !== 'all' && cxBucket(g)   !== selectedCx)   return false;
      if (selectedTime !== 'all' && timeBucket(g) !== selectedTime) return false;
      if (selectedMode !== 'all') {
        const coop = isCoop(g);
        if (selectedMode === 'coop' && !coop) return false;
        if (selectedMode === 'comp' &&  coop) return false;
      }
      if (selectedMechanic !== 'all' && !g.bgg?.mechanics?.includes(selectedMechanic)) return false;
      return true;
    });
  }

  /* ── Render ── */
  function playerLabel(g) {
    if (g.max >= 99) return g.min + '+';
    if (g.min === g.max) return String(g.min);
    return g.min + '–' + g.max;
  }

  function timeLabel(g) {
    const { mintime, maxtime } = g.bgg || {};
    if (!maxtime) return null;
    if (mintime && mintime !== maxtime) return `${mintime}–${maxtime} min`;
    return `${maxtime} min`;
  }

  function cxLabel(g) {
    const w = g.bgg?.weight;
    if (w == null) return null;
    const b = cxBucket(g);
    const cls = b === 'light' ? 'cx-light' : b === 'med' ? 'cx-med' : 'cx-heavy';
    return { cls, text: '⚙ ' + w.toFixed(1) };
  }

  function bggUrl(g) {
    return g.bggId ? `https://boardgamegeek.com/boardgame/${g.bggId}` : null;
  }

  function thumbHtml(g) {
    const url = bggUrl(g);
    const wrap = content => url
      ? `<a class="game-thumb-link" href="${url}" target="_blank" rel="noopener noreferrer" aria-label="Ver ${escAttr(g.name)} en BoardGameGeek">${content}</a>`
      : content;

    if (g.bgg?.thumbnail) {
      const u = escAttr(g.bgg.thumbnail);
      return wrap(`<div class="game-thumb-wrap">
        <img class="game-thumb-bg" aria-hidden="true" src="${u}" alt="">
        <img class="game-thumb" loading="lazy" src="${u}" alt="${escAttr(g.name)}"
        onerror="this.parentNode.innerHTML='<span class=&quot;game-thumb-placeholder&quot;>🎲</span>'"></div>`);
    }
    return wrap(`<div class="game-thumb-wrap"><span class="game-thumb-placeholder">🎲</span></div>`);
  }

  function renderGames() {
    const filtered  = getFiltered();
    const content   = document.getElementById('content');
    const countEl   = document.getElementById('results-count');
    const n         = filtered.length;

    countEl.textContent = n === 0 ? '' : n + ' juego' + (n === 1 ? '' : 's');

    if (n === 0) {
      content.innerHTML = '<div class="state-box"><span class="state-icon">😔</span>Ningún juego coincide con esos filtros.</div>';
      return;
    }

    content.innerHTML = '<div class="games-grid">' + filtered.map(g => {
      const hl         = highlighted === g.name ? ' highlight' : '';
      const ownerClass = g.owner.toLowerCase() === 'eze' ? 'badge-eze' : 'badge-eli';
      const catDisplay = g.cat || '—';
      const rating     = g.bgg?.rating ? `<span class="badge badge-rating">★ ${g.bgg.rating.toFixed(1)}</span>` : '';
      const cx         = cxLabel(g);
      const cxBadge    = cx ? `<span class="badge ${cx.cls}">${cx.text}</span>` : '';
      const tl         = timeLabel(g);
      const timeBadge  = tl ? `<span class="badge badge-meta">⏱ ${escHtml(tl)}</span>` : '';
      return `<div class="game-card${hl}">
        ${thumbHtml(g)}
        <div class="game-body">
          <div class="game-name">${escHtml(g.name)}</div>
          <div class="game-cat">${escHtml(catDisplay)}</div>
          <div class="game-badges">
            <span class="badge badge-players">👥 ${playerLabel(g)}</span>
            <span class="badge ${ownerClass}">${escHtml(g.owner)}</span>
            ${rating}${cxBadge}${timeBadge}
          </div>
        </div>
      </div>`;
    }).join('') + '</div>';

    if (highlighted) {
      content.querySelectorAll('.game-card').forEach(c => {
        if (c.querySelector('.game-name').textContent === highlighted) {
          setTimeout(() => c.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
        }
      });
    }
  }

  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function escAttr(s) { return escHtml(s).replace(/'/g, '&#39;'); }

  /* ── Random picker ── */
  function pickRandom() {
    const filtered = getFiltered();
    if (!filtered.length) return;
    highlighted = filtered[Math.floor(Math.random() * filtered.length)].name;
    renderGames();
  }

  /* ── Load from Google Sheets ── */
  async function loadGames(forceBust) {
    document.getElementById('content').innerHTML =
      '<div class="state-box"><span class="state-icon">⏳</span>Cargando juegos…</div>';
    document.getElementById('total-badge').textContent = 'Cargando…';
    document.getElementById('results-count').textContent = '';
    document.getElementById('bgg-status').textContent = '';
    highlighted = null;

    try {
      const url  = forceBust ? `${CSV_URL}&_=${Date.now()}` : CSV_URL;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
      const text = await resp.text();
      allGames   = parseCSV(text);
      if (allGames.length === 0) throw new Error('El sheet parece estar vacío o el formato no coincide.');
      document.getElementById('total-badge').textContent = allGames.length + ' juegos';
      renderGames();
      enrichWithBGG(); // async, no bloquea el render inicial
    } catch (err) {
      document.getElementById('total-badge').textContent = 'Error';
      document.getElementById('results-count').textContent = '';
      document.getElementById('content').innerHTML = `
        <div class="error-box">
          <strong>No se pudo cargar el sheet.</strong>
          Es necesario publicarlo como CSV primero:
          <ol>
            <li>Abrí el Google Sheet</li>
            <li>Menú <strong>Archivo → Compartir → Publicar en la web</strong></li>
            <li>Elegí la hoja y el formato <strong>Valores separados por comas (.csv)</strong></li>
            <li>Hacé clic en <strong>Publicar</strong> y confirmá</li>
            <li>Volvé a esta página y hacé clic en ↻ Actualizar</li>
          </ol>
          <code>Error: ${escHtml(err.message)}</code>
        </div>`;
    }
  }

  /* ── Event listeners ── */
  document.getElementById('player-count').addEventListener('input', () => {
    highlighted = null;
    renderGames();
  });

  document.getElementById('search-input').addEventListener('input', e => {
    searchQuery = e.target.value;
    highlighted = null;
    renderGames();
  });

  function wireChips(containerId, setter) {
    document.getElementById(containerId).addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      document.querySelectorAll('#' + containerId + ' .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      setter(chip.dataset.value);
      highlighted = null;
      renderGames();
    });
  }

  wireChips('owner-chips', v => selectedOwner = v);
  wireChips('cat-chips',   v => selectedCat   = v);
  wireChips('cx-chips',    v => selectedCx    = v);
  wireChips('time-chips',  v => selectedTime  = v);
  wireChips('mode-chips',  v => selectedMode  = v);

  document.getElementById('mechanic-select').addEventListener('change', e => {
    selectedMechanic = e.target.value;
    e.target.toggleAttribute('data-all', selectedMechanic === 'all');
    highlighted = null;
    renderGames();
  });

  loadGames();


// Shared controls
document.getElementById("refresh-btn")?.addEventListener("click", () => loadGames(true));
document.getElementById("random-btn")?.addEventListener("click", pickRandom);
