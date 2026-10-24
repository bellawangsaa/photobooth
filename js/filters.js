// Pixel filters — the same function powers the live preview and the final
// photo, so what guests see on screen is exactly what gets saved.
const FILTERS = [
  { id: 'original', label: 'Original', dot: '#F8EFD9', p: {} },
  { id: 'butter', label: 'Butter', dot: '#F8D976', p: { sat: 1.15, contrast: 1.05, bright: 1.04, tint: [14, 6, -14] } },
  { id: 'rose', label: 'Rosé', dot: '#F2717E', p: { sat: 1.05, bright: 1.05, tint: [22, -4, 8], fade: 0.08 } },
  { id: 'mono', label: 'Mono', dot: '#8a8a8a', p: { gray: 1, contrast: 1.2, bright: 1.05 } },
  { id: 'vintage', label: 'Vintage', dot: '#C9A66B', p: { sepia: 0.45, contrast: 0.92, fade: 0.18, grain: 22, bright: 1.03 } },
  { id: 'sky', label: 'Sky', dot: '#8DB8D8', p: { sat: 1.05, tint: [-8, 4, 18], bright: 1.04 } },
  { id: 'garden', label: 'Garden', dot: '#CDE0A5', p: { sat: 0.95, tint: [-4, 10, -10], fade: 0.1, contrast: 1.04 } },
  { id: 'pop', label: 'Pop', dot: '#9278A8', p: { sat: 1.55, contrast: 1.15 } },
  { id: 'film', label: 'Film B&W', dot: '#3b3b3b', p: { gray: 1, contrast: 1.35, grain: 30, fade: 0.08 } },
];

function applyFilter(img, p) {
  if (!p || !Object.keys(p).length) return img;
  const d = img.data;
  const gray = p.gray || 0, sepia = p.sepia || 0, sat = p.sat ?? 1;
  const con = p.contrast ?? 1, bri = p.bright ?? 1;
  const [tr, tg, tb] = p.tint || [0, 0, 0];
  const lift = (p.fade || 0) * 70, liftK = (255 - lift) / 255;
  const grain = p.grain || 0;

  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];

    if (gray) {
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      r += (l - r) * gray; g += (l - g) * gray; b += (l - b) * gray;
    }
    if (sepia) {
      const sr = 0.393 * r + 0.769 * g + 0.189 * b;
      const sg = 0.349 * r + 0.686 * g + 0.168 * b;
      const sb = 0.272 * r + 0.534 * g + 0.131 * b;
      r += (sr - r) * sepia; g += (sg - g) * sepia; b += (sb - b) * sepia;
    }
    if (sat !== 1) {
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat;
    }
    if (con !== 1) {
      r = (r - 128) * con + 128; g = (g - 128) * con + 128; b = (b - 128) * con + 128;
    }
    r = r * bri + tr; g = g * bri + tg; b = b * bri + tb;
    if (lift) {
      r = lift + r * liftK; g = lift + g * liftK; b = lift + b * liftK;
    }
    if (grain) {
      const n = (Math.random() - 0.5) * grain;
      r += n; g += n; b += n;
    }
    d[i] = r; d[i + 1] = g; d[i + 2] = b; // Uint8ClampedArray clamps for us
  }
  return img;
}

function getFilter(id) {
  return FILTERS.find((f) => f.id === id) || FILTERS[0];
}

// Returns a new canvas with the filter baked in (source is left untouched).
function filteredCopy(src, filterId) {
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(src, 0, 0);
  const p = getFilter(filterId).p;
  if (Object.keys(p).length) {
    const img = ctx.getImageData(0, 0, c.width, c.height);
    ctx.putImageData(applyFilter(img, p), 0, 0);
  }
  return c;
}
