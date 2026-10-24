// Layouts + brand frames, all drawn on canvas (no image assets needed).
const SCRIPT = '"Yellowtail", cursive';
const CAPS = '"Josefin Sans", sans-serif';

const C = {
  yellow: '#F8D976', pink: '#F2717E', pinkSoft: '#F7B5C4', cream: '#F8EFD9',
  blue: '#8DB8D8', olive: '#959235', red: '#C8201E', purple: '#9278A8',
  mint: '#CDE0A5', white: '#FFFFFF',
};

// Coordinates are in "design pixels"; the final export is rendered at 2x.
const LAYOUTS = {
  strip: {
    label: 'Strip', hint: '3 foto', w: 600, h: 1800, footerY: 1345,
    slots: [160, 565, 970].map((y) => ({ x: 50, y, w: 500, h: 375 })),
  },
  grid: {
    label: 'Grid', hint: '4 foto', w: 1200, h: 1500, footerY: 1090,
    slots: [[90, 190], [615, 190], [90, 650], [615, 650]].map(([x, y]) => ({ x, y, w: 495, h: 440 })),
  },
  single: {
    label: 'Single', hint: '1 foto', w: 1200, h: 1500, footerY: 1090,
    slots: [{ x: 90, y: 190, w: 1020, h: 900 }],
  },
};

/* ---------- drawing helpers ---------- */

function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const LOTUS = new Path2D(
  'M20 1C26.5 9 26.5 19 20 27C13.5 19 13.5 9 20 1Z' +
  'M19 27C11 25.5 3.5 19 1.5 10C9.5 10.5 16 17 19 27Z' +
  'M21 27C29 25.5 36.5 19 38.5 10C30.5 10.5 24 17 21 27Z'
);

function lotus(ctx, x, y, size, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 40, size / 40);
  ctx.translate(-20, -14);
  ctx.fillStyle = color;
  ctx.fill(LOTUS);
  ctx.restore();
}

// The quatrefoil "floral badge" from the brand sheet.
function flower(ctx, x, y, r, petal, center, inner) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = petal;
  const d = r * 0.42, pr = r * 0.58;
  for (let i = 0; i < 4; i++) {
    const a = (Math.PI / 2) * i;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * d, Math.sin(a) * d, pr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = center;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.56, 0, Math.PI * 2);
  ctx.fill();
  if (inner) {
    ctx.fillStyle = inner;
    for (let i = 0; i < 8; i++) {
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.3, r * 0.07, r * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function sparkle(ctx, x, y, r, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.quadraticCurveTo(0, 0, 0, r);
  ctx.quadraticCurveTo(0, 0, -r, 0);
  ctx.quadraticCurveTo(0, 0, 0, -r);
  ctx.fill();
  ctx.restore();
}

// Rect with bumpy (scalloped) outer edge, like the cut-out signs.
function scallopRect(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  const bump = (cx, cy) => { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); };
  const nx = Math.round(w / (r * 1.8)), ny = Math.round(h / (r * 1.8));
  for (let i = 0; i <= nx; i++) { bump(x + (w * i) / nx, y); bump(x + (w * i) / nx, y + h); }
  for (let i = 0; i <= ny; i++) { bump(x, y + (h * i) / ny); bump(x + w, y + (h * i) / ny); }
}

function seeded(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function setFont(ctx, family, size) {
  ctx.font = `${family === CAPS ? '700 ' : ''}${size}px ${family}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = family === CAPS ? `${(size * 0.2).toFixed(1)}px` : '0px';
}

function fitFont(ctx, text, family, size, maxW) {
  setFont(ctx, family, size);
  while (size > 8 && ctx.measureText(text).width > maxW) {
    size *= 0.94;
    setFont(ctx, family, size);
  }
  return size;
}

// Stacks text lines centered in the band [top, bottom].
function drawLines(ctx, L, lines, top, bottom) {
  const T = Math.min((bottom - top) * 0.4, L.w * 0.17);
  const sized = lines.map((ln) => {
    const fam = ln.font === 'caps' ? CAPS : SCRIPT;
    const size = fitFont(ctx, ln.text, fam, T * ln.rel, L.w * 0.84);
    return { ...ln, fam, size, h: size * (ln.font === 'caps' ? 1.9 : 1.15) };
  });
  let y = top + (bottom - top - sized.reduce((s, l) => s + l.h, 0)) / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const ln of sized) {
    setFont(ctx, ln.fam, ln.size);
    const cy = y + ln.h / 2;
    if (ln.shadow) {
      ctx.fillStyle = ln.shadow;
      ctx.fillText(ln.text, L.w / 2 + ln.size * 0.04, cy + ln.size * 0.05);
    }
    ctx.fillStyle = ln.color;
    ctx.fillText(ln.text, L.w / 2, cy);
    y += ln.h;
  }
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

function metaLine(meta) {
  return `${meta.name.toUpperCase()}  \u00B7  ${meta.date}`;
}

function slotBorders(ctx, L, radius, color, lw, outline, outlineW) {
  for (const s of L.slots) {
    rr(ctx, s.x - lw / 2, s.y - lw / 2, s.w + lw, s.h + lw, radius + lw / 2);
    ctx.lineWidth = lw;
    ctx.strokeStyle = color;
    ctx.stroke();
    if (outline) {
      rr(ctx, s.x - lw - outlineW / 2, s.y - lw - outlineW / 2, s.w + lw * 2 + outlineW, s.h + lw * 2 + outlineW, radius + lw);
      ctx.lineWidth = outlineW;
      ctx.strokeStyle = outline;
      ctx.stroke();
    }
  }
}

// Sticker positions: header corners, footer corners, and alternating photo corners.
function stickerSpots(L) {
  const u = L.w / 600;
  const spots = [
    [L.w * 0.12, L.slots[0].y * 0.5, 1],
    [L.w * 0.88, L.slots[0].y * 0.5, 1],
    [L.w * 0.1, L.footerY + 40 * u, 1.1],
    [L.w * 0.9, L.footerY + 40 * u, 1.1],
  ];
  L.slots.forEach((s, i) => {
    spots.push(i % 2 ? [s.x + s.w - 6 * u, s.y + s.h - 6 * u, 0.9] : [s.x + 6 * u, s.y + 6 * u, 0.9]);
  });
  return spots;
}

function patternFill(ctx, L, step, draw) {
  for (let y = step / 2, row = 0; y < L.h + step; y += step, row++) {
    for (let x = (row % 2 ? step / 2 : 0); x < L.w + step; x += step) draw(x, y);
  }
}

/* ---------- frames ---------- */

const FRAMES = [
  {
    id: 'bellys-bar',
    label: "Belly's Bar",
    radius: 18,
    bg(ctx, L) {
      const u = L.w / 600;
      ctx.fillStyle = C.yellow;
      ctx.fillRect(0, 0, L.w, L.h);
      // floral tile band at the bottom
      const band = 70 * u;
      ctx.fillStyle = '#EEF0C8';
      ctx.fillRect(0, L.h - band, L.w, band);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, L.h - band, L.w, band);
      ctx.clip();
      for (let x = band / 2; x < L.w + band; x += band) {
        const y = L.h - band / 2;
        ctx.strokeStyle = C.olive;
        ctx.lineWidth = 2.5 * u;
        ctx.beginPath();
        ctx.arc(x, y, band * 0.46, 0, Math.PI * 2);
        ctx.stroke();
        flower(ctx, x, y, band * 0.3, C.pink, '#F59AA4');
        sparkle(ctx, x + band / 2, y, band * 0.14, C.mint);
      }
      ctx.restore();
      // arched pink line
      ctx.strokeStyle = C.pink;
      ctx.lineWidth = 3 * u;
      const ins = 20 * u;
      rr(ctx, ins, ins, L.w - ins * 2, L.h - band - ins * 1.5, Math.min(L.w * 0.3, 160 * u));
      ctx.stroke();
    },
    fg(ctx, L, meta) {
      const u = L.w / 600;
      slotBorders(ctx, L, this.radius * u, C.cream, 8 * u, C.pink, 2.5 * u);
      const hy = L.slots[0].y;
      lotus(ctx, L.w / 2, hy * 0.38, 34 * u, C.pink);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      setFont(ctx, CAPS, 17 * u);
      ctx.fillStyle = C.pink;
      ctx.fillText('WELCOME TO,', L.w / 2, hy * 0.72);
      flower(ctx, L.slots[0].x + 10 * u, L.slots[0].y + 6 * u, 34 * u, C.pink, C.yellow, C.pink);
      const last = L.slots[L.slots.length - 1];
      sparkle(ctx, last.x + last.w - 14 * u, last.y + last.h - 10 * u, 20 * u, C.cream);
      drawLines(ctx, L, [
        { text: "Belly's Bar!", rel: 1, color: C.pink, shadow: '#E8C35A' },
        { text: 'a little celebration, a few good drinks', rel: 0.26, color: C.pink },
        { text: metaLine(meta), rel: 0.15, font: 'caps', color: C.pink },
      ], L.footerY + 10 * u, L.h - 70 * u - 10 * u);
    },
  },
  {
    id: 'bella-21',
    label: "Bella's 21st",
    radius: 22,
    bg(ctx, L) {
      const u = L.w / 600;
      ctx.fillStyle = C.white;
      ctx.fillRect(0, 0, L.w, L.h);
      const m = 22 * u, r = 18 * u;
      scallopRect(ctx, m, m, L.w - m * 2, L.h - m * 2, r, C.yellow);
      const t = m + 16 * u;
      ctx.fillStyle = C.cream;
      rr(ctx, t, t, L.w - t * 2, L.h - t * 2, 40 * u);
      ctx.fill();
      ctx.save();
      ctx.clip();
      patternFill(ctx, L, 70 * u, (x, y) => lotus(ctx, x, y, 22 * u, '#F1E2C2'));
      ctx.restore();
      const p = t + 10 * u;
      ctx.strokeStyle = C.pink;
      ctx.lineWidth = 2.5 * u;
      rr(ctx, p, p, L.w - p * 2, L.h - p * 2, 32 * u);
      ctx.stroke();
    },
    fg(ctx, L, meta) {
      const u = L.w / 600;
      slotBorders(ctx, L, this.radius * u, C.yellow, 9 * u);
      lotus(ctx, L.w / 2, L.slots[0].y * 0.55, 30 * u, C.pink);
      const rnd = seeded(21);
      stickerSpots(L).forEach(([x, y, s], i) => {
        if (i % 2) sparkle(ctx, x, y, 16 * u * s, C.pink);
        else flower(ctx, x, y, (26 + rnd() * 8) * u * s, C.pink, C.yellow, C.pink);
      });
      drawLines(ctx, L, [
        { text: "Bella's 21st", rel: 0.95, color: C.pink },
        { text: 'Birthday!', rel: 0.7, color: C.pink },
        { text: metaLine(meta), rel: 0.15, font: 'caps', color: C.olive },
      ], L.footerY, L.h - 60 * u);
    },
  },
  {
    id: 'made-it',
    label: "You've Made It",
    radius: 26,
    bg(ctx, L) {
      const u = L.w / 600;
      ctx.fillStyle = C.pink;
      ctx.fillRect(0, 0, L.w, L.h);
      const t = 22 * u;
      ctx.fillStyle = C.pinkSoft;
      rr(ctx, t, t, L.w - t * 2, L.h - t * 2, 56 * u);
      ctx.fill();
      const p = t + 14 * u;
      ctx.strokeStyle = C.white;
      ctx.lineWidth = 2.5 * u;
      rr(ctx, p, p, L.w - p * 2, L.h - p * 2, 44 * u);
      ctx.stroke();
      // dotted inner trim
      ctx.setLineDash([2 * u, 12 * u]);
      ctx.lineCap = 'round';
      ctx.lineWidth = 5 * u;
      const q = p + 12 * u;
      rr(ctx, q, q, L.w - q * 2, L.h - q * 2, 36 * u);
      ctx.stroke();
      ctx.setLineDash([]);
    },
    fg(ctx, L, meta) {
      const u = L.w / 600;
      slotBorders(ctx, L, this.radius * u, C.white, 8 * u);
      lotus(ctx, L.w / 2, L.slots[0].y * 0.55, 34 * u, C.pink);
      stickerSpots(L).forEach(([x, y, s], i) => {
        if (i % 2) sparkle(ctx, x, y, 18 * u * s, C.white);
        else flower(ctx, x, y, 26 * u * s, C.white, C.yellow, C.pink);
      });
      drawLines(ctx, L, [
        { text: "You've Made It!", rel: 0.95, color: C.white, shadow: C.pink },
        { text: 'Bella the Twenties', rel: 0.32, color: C.white },
        { text: metaLine(meta), rel: 0.15, font: 'caps', color: C.white },
      ], L.footerY, L.h - 50 * u);
    },
  },
  {
    id: 'bw-monogram',
    label: 'BW Monogram',
    radius: 20,
    bg(ctx, L) {
      const u = L.w / 600;
      ctx.fillStyle = C.pink;
      ctx.fillRect(0, 0, L.w, L.h);
      patternFill(ctx, L, 56 * u, (x, y) => lotus(ctx, x, y, 22 * u, '#F4848F'));
      const t = 24 * u;
      ctx.strokeStyle = C.white;
      ctx.lineWidth = 3 * u;
      rr(ctx, t, t, L.w - t * 2, L.h - t * 2, 48 * u);
      ctx.stroke();
      ctx.lineWidth = 1.5 * u;
      rr(ctx, t + 9 * u, t + 9 * u, L.w - t * 2 - 18 * u, L.h - t * 2 - 18 * u, 40 * u);
      ctx.stroke();
    },
    fg(ctx, L, meta) {
      const u = L.w / 600;
      slotBorders(ctx, L, this.radius * u, C.white, 7 * u);
      lotus(ctx, L.w / 2, L.slots[0].y * 0.55, 40 * u, C.yellow);
      stickerSpots(L).forEach(([x, y, s]) => sparkle(ctx, x, y, 17 * u * s, C.yellow));
      drawLines(ctx, L, [
        { text: 'B W', rel: 1.25, color: C.white, shadow: '#D95563' },
        { text: 'Bella the Twenties', rel: 0.32, color: C.white },
        { text: metaLine(meta), rel: 0.15, font: 'caps', color: C.yellow },
      ], L.footerY, L.h - 50 * u);
    },
  },
  {
    id: 'food-station',
    label: 'Cheers!',
    radius: 14,
    bg(ctx, L) {
      const u = L.w / 600;
      const sw = 30 * u;
      for (let x = 0, i = 0; x < L.w; x += sw, i++) {
        ctx.fillStyle = i % 2 ? '#E0545F' : C.pink;
        ctx.fillRect(x, 0, sw, L.h);
      }
    },
    fg(ctx, L, meta) {
      const u = L.w / 600;
      slotBorders(ctx, L, this.radius * u, C.cream, 12 * u, C.red, 3 * u);
      lotus(ctx, L.w / 2, L.slots[0].y * 0.55, 36 * u, C.cream);
      // cream scalloped label for the title
      const fy = L.footerY + 44 * u, fh = L.h - fy - 40 * u;
      const lw = Math.min(L.w - 80 * u, 520 * u);
      ctx.fillStyle = C.cream;
      const lx = (L.w - lw) / 2;
      rr(ctx, lx, fy, lw, fh, 60 * u);
      ctx.fill();
      for (let i = 0; i <= 10; i++) {
        const a = (Math.PI * 2 * i) / 10;
        ctx.beginPath();
        ctx.ellipse(L.w / 2 + Math.cos(a) * lw * 0.47, fy + fh / 2 + Math.sin(a) * fh * 0.42, 24 * u, 24 * u, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      lotus(ctx, L.w / 2, fy + 4 * u, 26 * u, C.pink);
      flower(ctx, lx + 14 * u, fy + fh - 10 * u, 28 * u, C.olive, C.cream, C.olive);
      drawLines(ctx, L, [
        { text: 'Cheers!', rel: 1, color: C.olive },
        { text: "to Bella's twenties", rel: 0.3, color: C.pink },
        { text: metaLine(meta), rel: 0.14, font: 'caps', color: C.olive },
      ], fy + 10 * u, fy + fh - 10 * u);
    },
  },
  {
    id: 'garden',
    label: 'Garden Party',
    radius: 24,
    bg(ctx, L) {
      const u = L.w / 600;
      ctx.fillStyle = C.mint;
      ctx.fillRect(0, 0, L.w, L.h);
      const rnd = seeded(7);
      const colors = [C.blue, C.purple, C.pink, C.yellow, C.white];
      patternFill(ctx, L, 90 * u, (x, y) => {
        const c = colors[Math.floor(rnd() * colors.length)];
        if (rnd() > 0.5) flower(ctx, x + rnd() * 20 * u, y, 14 * u, c, '#DDEBBE');
        else sparkle(ctx, x, y, 10 * u, c);
      });
      const t = 20 * u;
      ctx.strokeStyle = C.olive;
      ctx.lineWidth = 3 * u;
      rr(ctx, t, t, L.w - t * 2, L.h - t * 2, 30 * u);
      ctx.stroke();
    },
    fg(ctx, L, meta) {
      const u = L.w / 600;
      slotBorders(ctx, L, this.radius * u, C.white, 9 * u, C.olive, 2.5 * u);
      lotus(ctx, L.w / 2, L.slots[0].y * 0.55, 34 * u, C.purple);
      const palette = [[C.blue, C.white, C.blue], [C.purple, C.yellow, C.purple], [C.pink, C.yellow, C.pink]];
      stickerSpots(L).forEach(([x, y, s], i) => {
        const [a, b, c] = palette[i % palette.length];
        flower(ctx, x, y, 26 * u * s, a, b, c);
      });
      drawLines(ctx, L, [
        { text: 'Cheers to 21!', rel: 0.9, color: C.purple, shadow: C.white },
        { text: 'a garden party for Bella', rel: 0.3, color: C.olive },
        { text: metaLine(meta), rel: 0.15, font: 'caps', color: C.olive },
      ], L.footerY, L.h - 40 * u);
    },
  },
];

function drawPhotos(ctx, L, photos, radius) {
  L.slots.forEach((s, i) => {
    ctx.save();
    rr(ctx, s.x, s.y, s.w, s.h, radius);
    ctx.clip();
    const p = photos && photos[i];
    if (p) {
      ctx.drawImage(p, s.x, s.y, s.w, s.h);
    } else {
      // placeholder silhouette for the frame previews
      ctx.fillStyle = '#EADBC0';
      ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.fillStyle = '#F6EEDD';
      const cx = s.x + s.w / 2, r = Math.min(s.w, s.h) * 0.2;
      ctx.beginPath();
      ctx.arc(cx, s.y + s.h * 0.42, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx, s.y + s.h * 1.02, r * 2, r * 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });
}

function renderFrame(canvas, layoutId, frameId, photos, meta, scale) {
  const L = LAYOUTS[layoutId];
  const frame = FRAMES.find((f) => f.id === frameId) || FRAMES[0];
  canvas.width = Math.round(L.w * scale);
  canvas.height = Math.round(L.h * scale);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  frame.bg(ctx, L);
  drawPhotos(ctx, L, photos, frame.radius * (L.w / 600));
  frame.fg(ctx, L, meta);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
