// Vice Coast Cover Studio — the cover engine.
// Draws a multi-panel GTA-poster-style cover on a 2D canvas: panel layouts,
// a Vice City sunset / neon colour grade, bold Anton title lettering with a
// Pacifico script subtitle, a badge ribbon, a star heat meter, grain and a
// vignette. Pure canvas, no network, no library. Every photo is drawn from an
// <img> the caller loaded (a sample under app/samples/ or the user's own file).

// Six layouts. Each returns the panel rectangles for a cover of w x h, as
// fractions of the cover, plus where the title block sits.
export const LAYOUTS = {
  hero: { name: 'Hero + three', panels: 4, title: 'bottom' },
  grid4: { name: 'Four square', panels: 4, title: 'bottom' },
  nine: { name: 'Nine panel', panels: 9, title: 'top' },
  strip: { name: 'Full bleed + strip', panels: 4, title: 'bottom' },
  tilt: { name: 'Tilted snapshots', panels: 3, title: 'bottom' },
  duo: { name: 'Duo split', panels: 2, title: 'bottom' },
};

// Five colour grades. sky paints the background behind the panels; wash is
// laid over every panel; accent colours the subtitle and the badge.
export const GRADES = {
  sunset: {
    name: 'Vice Sunset', sky: ['#2b1055', '#ff5e62', '#ff9966'],
    wash: ['rgba(255,94,98,0.34)', 'rgba(255,153,102,0.10)'],
    accent: '#ff5e8a', sun: '#ffd166',
  },
  neon: {
    name: 'Neon Nights', sky: ['#12082b', '#ff2e88', '#00e5ff'],
    wash: ['rgba(255,46,136,0.36)', 'rgba(0,229,255,0.14)'],
    accent: '#00e5ff', sun: '#ff9de2',
  },
  golden: {
    name: 'Golden Hour', sky: ['#3d1c00', '#ff8c42', '#ffd166'],
    wash: ['rgba(255,140,66,0.32)', 'rgba(255,209,102,0.12)'],
    accent: '#ffd166', sun: '#fff3b0',
  },
  dusk: {
    name: 'Palm Dusk', sky: ['#0b1035', '#7b2ff7', '#f107a3'],
    wash: ['rgba(123,47,247,0.34)', 'rgba(241,7,163,0.14)'],
    accent: '#c77dff', sun: '#ff8fab',
  },
  noir: {
    name: 'Noir Heat', sky: ['#0a0a0a', '#3a0ca3', '#f72585'],
    wash: ['rgba(58,12,163,0.30)', 'rgba(247,37,133,0.16)'],
    accent: '#f72585', sun: '#e0aaff',
  },
};

export const SIZES = {
  '1080x1080': { w: 1080, h: 1080, label: 'Square 1080 x 1080' },
  '1080x1350': { w: 1080, h: 1350, label: 'Portrait 1080 x 1350' },
  '1920x1080': { w: 1920, h: 1080, label: 'Wide 1920 x 1080' },
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Panel rectangles for `layout` on a cover of w x h. Gutter g is in pixels. */
export function layoutPanels(layout, w, h) {
  const g = Math.max(6, Math.round(Math.min(w, h) * 0.014));
  const P = (x, y, pw, ph, rot = 0) => ({ x, y, w: pw, h: ph, rot });
  switch (layout) {
    case 'grid4': {
      const cw = (w - g * 3) / 2, ch = (h - g * 3) / 2;
      return [P(g, g, cw, ch), P(g * 2 + cw, g, cw, ch),
        P(g, g * 2 + ch, cw, ch), P(g * 2 + cw, g * 2 + ch, cw, ch)];
    }
    case 'nine': {
      // The title block sits at the top of a nine-panel cover, so the grid
      // starts below it instead of running underneath the lettering.
      const top = h * 0.175;
      const cw = (w - g * 4) / 3, ch = (h - top - g * 4) / 3, out = [];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++)
        out.push(P(g + c * (cw + g), top + g + r * (ch + g), cw, ch));
      return out;
    }
    case 'strip': {
      const stripH = Math.round(h * 0.24), cw = (w - g * 4) / 3;
      return [P(g, g, w - g * 2, h - stripH - g * 2),
        P(g, h - stripH, cw, stripH - g), P(g * 2 + cw, h - stripH, cw, stripH - g),
        P(g * 3 + cw * 2, h - stripH, cw, stripH - g)];
    }
    case 'tilt': {
      const pw = w * 0.52, ph = h * 0.56;
      return [P(w * 0.05, h * 0.06, pw, ph, -0.07),
        P(w * 0.43, h * 0.10, pw, ph, 0.05), P(w * 0.24, h * 0.30, pw, ph, -0.015)];
    }
    case 'duo':
      return [P(g, g, (w - g * 3) / 2, h - g * 2), P(g * 2 + (w - g * 3) / 2, g, (w - g * 3) / 2, h - g * 2)];
    case 'hero':
    default: {
      const heroW = Math.round(w * 0.60), rh = (h - g * 4) / 3;
      return [P(g, g, heroW - g, h - g * 2),
        P(heroW + g, g, w - heroW - g * 2, rh),
        P(heroW + g, g * 2 + rh, w - heroW - g * 2, rh),
        P(heroW + g, g * 3 + rh * 2, w - heroW - g * 2, rh)];
    }
  }
}

/** Cover-fits `img` into a rect, honouring a panel's zoom and pan offsets. */
export function drawPanelPhoto(ctx, img, rect, panel) {
  if (!img || !img.naturalWidth) return;
  const zoom = panel.zoom || 1;
  const scale = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight) * zoom;
  const pw = img.naturalWidth * scale, ph = img.naturalHeight * scale;
  const ox = (panel.ox || 0) * rect.w * 0.5, oy = (panel.oy || 0) * rect.h * 0.5;
  ctx.drawImage(img, rect.x + (rect.w - pw) / 2 + ox, rect.y + (rect.h - ph) / 2 + oy, pw, ph);
}

/** The classic striped sunset sun, drawn behind the panels. */
export function drawSunsetSun(ctx, w, h, grade) {
  const cx = w * 0.5, cy = h * 0.34, r = Math.min(w, h) * 0.21;
  const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 2.1);
  glow.addColorStop(0, grade.sun + '55');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  const sun = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  sun.addColorStop(0, '#fff7cc');
  sun.addColorStop(0.55, grade.sun);
  sun.addColorStop(1, grade.accent);
  ctx.fillStyle = sun;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.fillStyle = grade.sky[0];
  let y = cy + r * 0.08, gap = r * 0.045;
  while (y < cy + r) { ctx.fillRect(cx - r, y, r * 2, gap); y += gap * 2.6; gap *= 1.5; }
  ctx.restore();
}

/** Film grain: deterministic so the same cover always renders the same. */
export function drawGrain(ctx, w, h, seed = 20261120) {
  const rnd = mulberry32(seed);
  ctx.save();
  const n = Math.round((w * h) / 420);
  for (let i = 0; i < n; i++) {
    const v = rnd();
    ctx.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(rnd() * w, rnd() * h, 1.4, 1.4);
  }
  ctx.restore();
}

function drawVignette(ctx, w, h) {
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(10,0,20,0.38)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}

/** Bold poster lettering: white fill, black outline, hot-pink drop shadow. */
export function drawTitleBlock(ctx, w, h, state, grade) {
  const title = (state.title || '').trim().toUpperCase();
  const subtitle = (state.subtitle || '').trim();
  const top = LAYOUTS[state.layout]?.title === 'top';
  const bandH = h * 0.20;
  const bandY = top ? 0 : h - bandH;
  if (!top) {
    const shade = ctx.createLinearGradient(0, bandY - h * 0.06, 0, h);
    shade.addColorStop(0, 'rgba(10,0,20,0)');
    shade.addColorStop(1, 'rgba(10,0,20,0.72)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, bandY - h * 0.06, w, bandH + h * 0.06);
  }
  const cx = w * 0.5;
  let size = top ? Math.min(w * 0.10, h * 0.09) : Math.min(w * 0.115, h * 0.105);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if (title) {
    ctx.font = `${size}px Anton, "Arial Black", sans-serif`;
    while (ctx.measureText(title).width > w * 0.92 && size > 14) {
      size -= 2;
      ctx.font = `${size}px Anton, "Arial Black", sans-serif`;
    }
    const ty = top ? bandY + size * 1.05 : h - h * 0.055 - (subtitle ? size * 0.42 : 0);
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, size * 0.10);
    ctx.strokeStyle = '#12041f';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = grade.accent;
    ctx.shadowBlur = size * 0.22;
    ctx.shadowOffsetX = size * 0.045;
    ctx.shadowOffsetY = size * 0.045;
    ctx.strokeText(title, cx, ty);
    ctx.fillText(title, cx, ty);
    ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    if (subtitle) {
      const subSize = size * 0.42;
      ctx.font = `${subSize}px Pacifico, cursive`;
      ctx.fillStyle = grade.accent;
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = subSize * 0.25;
      ctx.fillText(subtitle, cx, ty + subSize * 1.25);
      ctx.shadowBlur = 0;
    }
  }
  // Star heat meter under the title (or above it for the top layout).
  const stars = Math.max(0, Math.min(5, state.stars ?? 5));
  const starSize = Math.min(w, h) * 0.032;
  const gap = starSize * 1.25, total = stars * gap - (gap - starSize);
  let sx = cx - total / 2;
  const sy = top ? bandY + size * 1.75 : h - h * 0.018;
  ctx.font = `${starSize}px sans-serif`;
  ctx.textAlign = 'left';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < stars ? '#ffd166' : 'rgba(255,255,255,0.35)';
    ctx.fillText('★', sx + i * gap, sy);
  }
  // Badge ribbon, top right, tilted.
  const badge = (state.badge || '').trim().toUpperCase();
  if (badge) {
    const bw = Math.min(w * 0.30, ctx.measureText(badge).width + w * 0.05);
    const bh = h * 0.038;
    ctx.save();
    ctx.translate(w - bw * 0.62, bh * 1.5);
    ctx.rotate(0.06);
    ctx.fillStyle = grade.accent;
    ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1.5, bh * 0.08);
    ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);
    ctx.fillStyle = '#ffffff';
    ctx.font = `${bh * 0.52}px Anton, "Arial Black", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badge, 0, bh * 0.03);
    ctx.restore();
  }
}

/**
 * Draws the whole cover. `state` is { layout, grade, title, subtitle, badge,
 * stars, panels: [{ img, zoom, ox, oy }] } — panels are matched to the
 * layout's rectangles in order. `photos` is unused; kept for the editor.
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const grade = GRADES[state.grade] || GRADES.sunset;
  const layout = LAYOUTS[state.layout] ? state.layout : 'hero';
  // Sky.
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, grade.sky[0]);
  sky.addColorStop(0.55, grade.sky[1]);
  sky.addColorStop(1, grade.sky[2]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  drawSunsetSun(ctx, w, h, grade);
  // Panels.
  const rects = layoutPanels(layout, w, h);
  const panels = state.panels || [];
  rects.forEach((rect, i) => {
    const panel = panels[i] || {};
    ctx.save();
    ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
    if (rect.rot) ctx.rotate(rect.rot);
    ctx.translate(-rect.w / 2, -rect.h / 2);
    ctx.beginPath();
    const r = Math.max(4, Math.min(w, h) * 0.008);
    ctx.roundRect(0, 0, rect.w, rect.h, r);
    ctx.clip();
    if (panel.img) drawPanelPhoto(ctx, panel.img, { x: 0, y: 0, w: rect.w, h: rect.h }, panel);
    else { ctx.fillStyle = '#241533'; ctx.fillRect(0, 0, rect.w, rect.h); }
    const wash = ctx.createLinearGradient(0, 0, 0, rect.h);
    wash.addColorStop(0, grade.wash[0]);
    wash.addColorStop(1, grade.wash[1]);
    ctx.fillStyle = wash;
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillRect(0, 0, rect.w, rect.h);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
    // Ink frame: white inner line, black outer line.
    ctx.save();
    ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
    if (rect.rot) ctx.rotate(rect.rot);
    ctx.translate(-rect.w / 2, -rect.h / 2);
    ctx.beginPath();
    ctx.roundRect(0, 0, rect.w, rect.h, Math.max(4, Math.min(w, h) * 0.008));
    ctx.lineWidth = Math.max(3, Math.min(w, h) * 0.006);
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.lineWidth = Math.max(1.5, Math.min(w, h) * 0.002);
    ctx.strokeStyle = 'rgba(18,4,31,0.85)';
    ctx.beginPath();
    ctx.roundRect(4, 4, rect.w - 8, rect.h - 8, Math.max(3, Math.min(w, h) * 0.006));
    ctx.stroke();
    ctx.restore();
  });
  drawTitleBlock(ctx, w, h, state, grade);
  drawGrain(ctx, w, h);
  drawVignette(ctx, w, h);
}
