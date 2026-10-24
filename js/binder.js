// Photo Binder: a gallery of every photo saved to the Drive folder.
// Opened with the #binder hash so it can be bookmarked or shared directly.
(() => {
  const $ = (s) => document.querySelector(s);
  const screens = ['welcome', 'booth'];

  const state = { photos: [], guest: 'all', index: 0, loaded: false, loading: false, returnTo: 'welcome' };

  const thumb = (id, w) => `https://drive.google.com/thumbnail?id=${id}&sz=w${w}`;
  const fallback = (id, w) => `https://lh3.googleusercontent.com/d/${id}=w${w}`;

  function formatTime(ms) {
    return new Date(ms).toLocaleString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  function setStatus(msg) {
    const el = $('#binderStatus');
    el.textContent = msg || '';
    el.hidden = !msg;
  }

  /* ---------- routing ---------- */

  function open() {
    const visible = screens.find((id) => !$(`#${id}`).hidden);
    if (visible) state.returnTo = visible;
    screens.forEach((id) => { $(`#${id}`).hidden = true; });
    $('#binder').hidden = false;
    window.scrollTo(0, 0);
    window.dispatchEvent(new Event('binder:open'));
    if (!state.loaded) load();
  }

  function close() {
    if ($('#viewer').open) $('#viewer').close();
    $('#binder').hidden = true;
    $(`#${state.returnTo}`).hidden = false;
    window.dispatchEvent(new Event('binder:close'));
  }

  function route() {
    if (location.hash === '#binder') open();
    else if (!$('#binder').hidden) close();
  }

  window.addEventListener('hashchange', route);
  $('#binderBack').addEventListener('click', () => {
    history.replaceState(null, '', location.pathname + location.search);
    close();
  });

  /* ---------- data ---------- */

  async function load() {
    const url = (window.PHOTOBOOTH_CONFIG || {}).appsScriptUrl;
    if (!url) { setStatus('Photo Binder belum tersambung ke Google Drive.'); return; }
    if (state.loading) return;
    state.loading = true;
    setStatus('Membuka binder…');
    try {
      const res = await fetch(`${url}?action=list`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Gagal memuat');
      if (!Array.isArray(json.photos)) {
        throw new Error('Apps Script belum versi terbaru. Deploy ulang Code.gs (lihat README)');
      }
      state.photos = json.photos;
      state.loaded = true;
      if (state.guest !== 'all' && !state.photos.some((p) => p.guest === state.guest)) state.guest = 'all';
      render();
      setStatus(state.photos.length ? '' : 'Belum ada foto. Yuk jadi yang pertama di photobooth!');
    } catch (err) {
      setStatus(`Gagal membuka binder: ${err.message}`);
    } finally {
      state.loading = false;
    }
  }

  $('#binderRefresh').addEventListener('click', load);

  /* ---------- render ---------- */

  function visible() {
    return state.guest === 'all' ? state.photos : state.photos.filter((p) => p.guest === state.guest);
  }

  function render() {
    const guests = [...new Set(state.photos.map((p) => p.guest))].sort((a, b) => a.localeCompare(b));
    const chips = $('#guestChips');
    chips.innerHTML = '';
    for (const g of ['all', ...guests]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = g === 'all' ? `Semua (${state.photos.length})` : g;
      b.setAttribute('aria-pressed', String(state.guest === g));
      b.addEventListener('click', () => { state.guest = g; render(); });
      chips.append(b);
    }
    chips.hidden = guests.length < 2;

    const list = visible();
    $('#binderCount').textContent = `${state.photos.length} foto · ${guests.length} tamu`;

    const grid = $('#binderGrid');
    grid.innerHTML = '';
    list.forEach((p, i) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'polaroid';
      card.style.setProperty('--tilt', `${((i * 37) % 5) - 2}deg`);
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.alt = `Foto ${p.guest}`;
      img.src = thumb(p.id, 600);
      img.addEventListener('error', () => { if (!img.dataset.fb) { img.dataset.fb = 1; img.src = fallback(p.id, 600); } }, { once: false });
      const cap = document.createElement('span');
      cap.className = 'script';
      cap.textContent = p.guest;
      card.append(img, cap);
      card.addEventListener('click', () => show(i));
      grid.append(card);
    });
  }

  /* ---------- viewer ---------- */

  function show(i) {
    const list = visible();
    if (!list.length) return;
    state.index = (i + list.length) % list.length;
    const p = list[state.index];
    const img = $('#viewerImg');
    img.dataset.fb = '';
    img.src = thumb(p.id, 2000);
    img.onerror = () => { if (!img.dataset.fb) { img.dataset.fb = 1; img.src = fallback(p.id, 2000); } };
    img.alt = `Foto ${p.guest}`;
    $('#viewerName').textContent = p.guest;
    $('#viewerDate').textContent = formatTime(p.time);
    $('#viewerDownload').href = `https://drive.google.com/uc?export=download&id=${p.id}`;
    $('#viewerOpen').href = `https://drive.google.com/file/d/${p.id}/view`;
    const many = list.length > 1;
    $('#viewerPrev').hidden = !many;
    $('#viewerNext').hidden = !many;
    if (!$('#viewer').open) $('#viewer').showModal();
  }

  $('#viewerClose').addEventListener('click', () => $('#viewer').close());
  $('#viewerPrev').addEventListener('click', () => show(state.index - 1));
  $('#viewerNext').addEventListener('click', () => show(state.index + 1));
  $('#viewer').addEventListener('click', (e) => { if (e.target === $('#viewer')) $('#viewer').close(); });
  $('#viewer').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(state.index - 1);
    if (e.key === 'ArrowRight') show(state.index + 1);
  });

  let touchX = null;
  $('#viewer').addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  $('#viewer').addEventListener('touchend', (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 50) show(state.index + (dx < 0 ? 1 : -1));
  });

  route();
})();
