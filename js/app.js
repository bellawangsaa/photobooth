(() => {
  const EXPORT_SCALE = 2;
  const PREVIEW_W = 640;
  const COUNTDOWN = 3;

  const $ = (s) => document.querySelector(s);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const state = {
    name: '',
    layout: 'strip',
    frame: FRAMES[0].id,
    filter: 'original',
    shots: [],
    filtered: new Map(),
    shooting: false,
    showingResult: false,
    version: 0,       // bumps whenever the result image changes
    sentVersion: -1,  // version last saved to Drive
    uploading: false,
  };

  const video = $('#video');
  const preview = $('#preview');
  const pctx = preview.getContext('2d', { willReadFrequently: true });
  const result = $('#result');
  let stream = null;

  /* ---------- helpers ---------- */

  function today() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
  }

  function meta() {
    return { name: state.name || 'Guest', date: today() };
  }

  function fileName() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const safe = state.name.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'Guest';
    return `${safe} - ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}.${p(d.getMinutes())}.${p(d.getSeconds())}.jpg`;
  }

  function toast(msg, kind = 'ok') {
    const t = $('#toast');
    t.textContent = msg;
    t.dataset.kind = kind;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { t.hidden = true; }, 4200);
  }

  function slotAspect() {
    const s = LAYOUTS[state.layout].slots[0];
    return s.w / s.h;
  }

  // Draw `src` into a (dw x dh) box, cropping to cover, mirrored like a selfie.
  function drawCover(ctx, src, sw, sh, dw, dh) {
    const k = Math.max(dw / sw, dh / sh);
    const cw = dw / k, ch = dh / k;
    ctx.save();
    ctx.translate(dw, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, dw, dh);
    ctx.restore();
  }

  /* ---------- screens ---------- */

  try { $('#nameInput').value = localStorage.getItem('pb-name') || ''; } catch {}

  $('#nameForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const n = $('#nameInput').value.trim().slice(0, 30);
    if (!n) { $('#nameInput').focus(); return; }
    state.name = n;
    try { localStorage.setItem('pb-name', n); } catch {}
    enterBooth();
  });

  async function enterBooth() {
    $('#welcome').hidden = true;
    $('#booth').hidden = false;
    $('#hello').textContent = state.name;
    resetShots();
    buildFrameThumbs();
    if (!stream) await startCamera();
    window.scrollTo(0, 0);
  }

  $('#nextGuest').addEventListener('click', () => {
    if (state.shooting) return;
    resetShots();
    state.name = '';
    $('#nameInput').value = '';
    try { localStorage.removeItem('pb-name'); } catch {}
    $('#booth').hidden = true;
    $('#welcome').hidden = false;
    $('#nameInput').focus();
  });

  /* ---------- camera ---------- */

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      showCamError('Browser ini belum bisa akses kamera. Pastikan web dibuka lewat HTTPS (atau localhost) di Chrome/Safari terbaru.');
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
      $('#camError').hidden = true;
      requestAnimationFrame(loop);
    } catch (err) {
      const denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
      showCamError(denied
        ? 'Akses kamera ditolak. Izinkan kamera di pengaturan browser, lalu klik "Coba lagi".'
        : 'Kamera tidak ditemukan atau sedang dipakai aplikasi lain.');
    }
  }

  function showCamError(msg) {
    $('#camErrorMsg').textContent = msg;
    $('#camError').hidden = false;
  }

  $('#camRetry').addEventListener('click', startCamera);

  function loop() {
    requestAnimationFrame(loop);
    if (state.showingResult || !video.videoWidth) return;
    const w = PREVIEW_W, h = Math.round(PREVIEW_W / slotAspect());
    if (preview.width !== w || preview.height !== h) { preview.width = w; preview.height = h; }
    drawCover(pctx, video, video.videoWidth, video.videoHeight, w, h);
    const p = getFilter(state.filter).p;
    if (Object.keys(p).length) pctx.putImageData(applyFilter(pctx.getImageData(0, 0, w, h), p), 0, 0);
  }

  /* ---------- controls ---------- */

  function chip(group, value, label, extra = '') {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.dataset.value = value;
    b.innerHTML = `${extra}<span>${label}</span>`;
    b.setAttribute('aria-pressed', String(state[group] === value));
    b.addEventListener('click', () => select(group, value));
    return b;
  }

  function buildControls() {
    const lay = $('#layoutChips');
    for (const [id, L] of Object.entries(LAYOUTS)) {
      lay.append(chip('layout', id, `${L.label} <small>${L.hint}</small>`));
    }
    const fil = $('#filterChips');
    for (const f of FILTERS) {
      fil.append(chip('filter', f.id, f.label, `<i class="dot" style="background:${f.dot}"></i>`));
    }
  }

  function buildFrameThumbs() {
    const box = $('#frameThumbs');
    box.innerHTML = '';
    const L = LAYOUTS[state.layout];
    for (const f of FRAMES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'thumb';
      b.dataset.value = f.id;
      b.setAttribute('aria-pressed', String(state.frame === f.id));
      b.title = f.label;
      const c = document.createElement('canvas');
      renderFrame(c, state.layout, f.id, null, meta(), 260 / L.h);
      const cap = document.createElement('span');
      cap.textContent = f.label;
      b.append(c, cap);
      b.addEventListener('click', () => select('frame', f.id));
      box.append(b);
    }
  }

  function markActive(container, value) {
    for (const el of document.querySelectorAll(`${container} [data-value]`)) {
      el.setAttribute('aria-pressed', String(el.dataset.value === value));
    }
  }

  function select(group, value) {
    if (state.shooting || state[group] === value) return;
    if (group === 'layout' && state.shots.length) {
      if (!confirm('Ganti layout akan menghapus foto yang sudah diambil. Lanjut?')) return;
    }
    state[group] = value;
    if (group === 'layout') {
      markActive('#layoutChips', value);
      resetShots();
      buildFrameThumbs();
    } else if (group === 'filter') {
      markActive('#filterChips', value);
      if (state.showingResult) renderResult();
    } else {
      markActive('#frameThumbs', value);
      if (state.showingResult) renderResult();
    }
  }

  /* ---------- shooting ---------- */

  function resetShots() {
    state.shots = [];
    state.filtered.clear();
    state.version++;
    showResult(false);
    renderFilm();
  }

  function renderFilm() {
    const film = $('#film');
    film.innerHTML = '';
    const n = LAYOUTS[state.layout].slots.length;
    for (let i = 0; i < n; i++) {
      const cell = document.createElement('div');
      cell.className = 'film-cell';
      cell.style.aspectRatio = String(slotAspect());
      if (state.shots[i]) {
        const c = filteredCopy(state.shots[i], state.filter);
        cell.append(c);
      } else {
        cell.textContent = i + 1;
      }
      film.append(cell);
    }
  }

  async function countdown(n) {
    const el = $('#countdown');
    el.hidden = false;
    for (let i = n; i > 0; i--) {
      el.textContent = i;
      el.classList.remove('pop');
      void el.offsetWidth;
      el.classList.add('pop');
      await wait(1000);
    }
    el.hidden = true;
  }

  function flash() {
    const f = $('#flash');
    f.classList.remove('go');
    void f.offsetWidth;
    f.classList.add('go');
  }

  function captureShot() {
    const s = LAYOUTS[state.layout].slots[0];
    const c = document.createElement('canvas');
    c.width = s.w * EXPORT_SCALE;
    c.height = s.h * EXPORT_SCALE;
    drawCover(c.getContext('2d'), video, video.videoWidth, video.videoHeight, c.width, c.height);
    return c;
  }

  async function shoot() {
    if (state.shooting) return;
    if (!stream || !video.videoWidth) { toast('Kamera belum siap.', 'error'); return; }
    resetShots();
    state.shooting = true;
    document.body.classList.add('is-shooting');
    bringStageIntoView();
    const n = LAYOUTS[state.layout].slots.length;
    try {
      for (let i = 0; i < n; i++) {
        $('#shotCounter').textContent = `Foto ${i + 1} dari ${n}`;
        $('#shotCounter').hidden = false;
        await countdown(COUNTDOWN);
        flash();
        state.shots.push(captureShot());
        renderFilm();
        await wait(i < n - 1 ? 900 : 500);
      }
    } finally {
      state.shooting = false;
      document.body.classList.remove('is-shooting');
      $('#shotCounter').hidden = true;
    }
    renderResult();
    showResult(true);
    bringStageIntoView();
    sendToDrive(); // auto-save every finished session
  }

  // On phones the controls sit below the camera; scroll back so guests see the countdown.
  function bringStageIntoView() {
    if (!window.matchMedia('(max-width: 880px)').matches) return;
    const top = $('#stage').getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.3) $('#stage').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function photosForFilter() {
    if (!state.filtered.has(state.filter)) {
      state.filtered.set(state.filter, state.shots.map((s) => filteredCopy(s, state.filter)));
    }
    return state.filtered.get(state.filter);
  }

  function renderResult() {
    renderFrame(result, state.layout, state.frame, photosForFilter(), meta(), EXPORT_SCALE);
    state.version++;
    updateDriveBtn();
  }

  // Phone-only tabs in the bottom sheet (on desktop every group is visible).
  function setTab(tab) {
    $('.panel').dataset.tab = tab;
    for (const t of document.querySelectorAll('.tab')) t.setAttribute('aria-selected', String(t.dataset.tab === tab));
  }
  for (const t of document.querySelectorAll('.tab')) t.addEventListener('click', () => setTab(t.dataset.tab));

  function showResult(on) {
    if (on && $('.panel').dataset.tab === 'layout') setTab('frame');
    state.showingResult = on;
    document.body.classList.toggle('has-result', on);
    $('#stage').dataset.layout = state.layout;
  }

  function updateDriveBtn() {
    const b = $('#driveBtn');
    const saved = state.sentVersion === state.version;
    b.disabled = saved || state.uploading;
    b.querySelector('span').textContent = state.uploading ? 'Menyimpan ke Drive…'
      : saved ? 'Tersimpan di Drive ✓'
      : state.sentVersion >= 0 ? 'Simpan versi ini ke Drive'
      : 'Simpan ke Drive';
  }

  /* ---------- output ---------- */

  function download() {
    result.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fileName();
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, 'image/jpeg', 0.92);
  }

  async function sendToDrive() {
    const url = (window.PHOTOBOOTH_CONFIG || {}).appsScriptUrl;
    if (!url) {
      toast('Link Google Drive belum disetup — isi appsScriptUrl di js/config.js (lihat README).', 'error');
      return;
    }
    if (state.uploading || state.sentVersion === state.version) return;
    // Snapshot now: the guest may change frame/filter or leave while this uploads.
    const version = state.version;
    const name = state.name;
    const payload = JSON.stringify({ name, filename: fileName(), image: result.toDataURL('image/jpeg', 0.9) });
    state.uploading = true;
    updateDriveBtn();
    try {
      // text/plain keeps this a "simple" request, so Apps Script needs no CORS preflight.
      const res = await fetch(url, { method: 'POST', body: payload });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Upload gagal');
      state.sentVersion = version;
      toast(`Yay! Foto ${name} sudah tersimpan di Drive 💛`);
    } catch (err) {
      toast(`Gagal simpan ke Drive: ${err.message}. Coba tekan "Simpan ke Drive" lagi.`, 'error');
    } finally {
      state.uploading = false;
      updateDriveBtn();
    }
  }

  $('#shootBtn').addEventListener('click', shoot);
  $('#retakeBtn').addEventListener('click', () => { if (!state.shooting) resetShots(); });
  $('#downloadBtn').addEventListener('click', download);
  $('#driveBtn').addEventListener('click', sendToDrive);

  document.addEventListener('keydown', (e) => {
    if ($('#booth').hidden || e.target.matches('input, textarea')) return;
    if (e.code === 'Space' && !state.showingResult) { e.preventDefault(); shoot(); }
  });

  buildControls();
  renderFilm();
  // Fonts are drawn onto canvas, so make sure they're loaded before thumbnails render.
  Promise.all([
    document.fonts.load('40px "Yellowtail"'),
    document.fonts.load('700 20px "Josefin Sans"'),
  ]).catch(() => {}).then(() => { if (!$('#booth').hidden) buildFrameThumbs(); });
})();
