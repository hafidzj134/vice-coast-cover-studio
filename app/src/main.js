// Vice Coast Cover Studio — the editor.
// Loads the two built-in sample photos (free to use, made for make.fun) or
// the user's own files, lets the user pick a layout and a grade, crop and
// position each panel's photo, edit the caption, and export a PNG in one of
// the three common post sizes. Photos are read on this machine only.

import { drawCover, layoutPanels, LAYOUTS, GRADES, SIZES } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const status = document.getElementById('status');
const titleInput = document.getElementById('title');
const subtitleInput = document.getElementById('subtitle');
const badgeInput = document.getElementById('badge');
const sizeSelect = document.getElementById('size');
const layoutBar = document.getElementById('layouts');
const gradeBar = document.getElementById('grades');
const panelBox = document.getElementById('panel');
const panelName = document.getElementById('panelName');
const photoSelect = document.getElementById('panelPhoto');
const zoomInput = document.getElementById('zoom');
const panXInput = document.getElementById('panX');
const panYInput = document.getElementById('panY');
const fileInput = document.getElementById('upload');

const SAMPLES = {
  boulevard: { label: 'Boulevard (sample)', url: 'samples/boulevard.jpg' },
  pier: { label: 'Pier (sample)', url: 'samples/pier.jpg' },
};

const state = {
  layout: 'hero',
  grade: 'sunset',
  size: '1080x1080',
  title: 'VICE COAST',
  subtitle: 'sunset heist',
  badge: 'EST. 2026',
  stars: 5,
  panels: [],
  selected: 0,
};

const images = {}; // key -> loaded <img>
const uploads = {}; // key -> { label, url }

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function panelCount() {
  return LAYOUTS[state.layout].panels;
}

function currentPanels() {
  return state.panels.slice(0, panelCount()).map((p) => ({
    img: p.img ? images[p.img] ?? null : null,
    zoom: p.zoom, ox: p.ox, oy: p.oy,
  }));
}

function redraw() {
  const size = SIZES[state.size];
  canvas.width = size.w;
  canvas.height = size.h;
  drawCover(canvas, { ...state, panels: currentPanels() });
  highlightSelectedPanel();
}

function highlightSelectedPanel() {
  const rects = layoutPanels(state.layout, canvas.width, canvas.height);
  const box = document.getElementById('selection');
  if (!box || !rects[state.selected]) { if (box) box.style.display = 'none'; return; }
  const r = rects[state.selected];
  const scale = canvas.clientWidth / canvas.width;
  box.style.display = 'block';
  box.style.left = `${r.x * scale}px`;
  box.style.top = `${r.y * scale}px`;
  box.style.width = `${r.w * scale}px`;
  box.style.height = `${r.h * scale}px`;
}

function refreshPanelControls() {
  const n = panelCount();
  if (state.selected >= n) state.selected = 0;
  const p = state.panels[state.selected];
  panelName.textContent = `Panel ${state.selected + 1} of ${n}`;
  photoSelect.innerHTML = '';
  for (const [key, s] of Object.entries(SAMPLES)) {
    const o = document.createElement('option');
    o.value = key; o.textContent = s.label;
    photoSelect.appendChild(o);
  }
  for (const [key, u] of Object.entries(uploads)) {
    const o = document.createElement('option');
    o.value = key; o.textContent = u.label;
    photoSelect.appendChild(o);
  }
  photoSelect.value = p.img || 'boulevard';
  zoomInput.value = p.zoom;
  panXInput.value = p.ox;
  panYInput.value = p.oy;
  panelBox.hidden = false;
}

function buildToolbar() {
  for (const [key, layout] of Object.entries(LAYOUTS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = layout.name;
    b.dataset.layout = key;
    b.className = key === state.layout ? 'on' : '';
    b.addEventListener('click', () => {
      state.layout = key;
      [...layoutBar.children].forEach((c) => c.classList.toggle('on', c === b));
      state.selected = 0;
      refreshPanelControls();
      redraw();
    });
    layoutBar.appendChild(b);
  }
  for (const [key, grade] of Object.entries(GRADES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch' + (key === state.grade ? ' on' : '');
    b.dataset.grade = key;
    b.textContent = grade.name;
    b.style.setProperty('--g1', grade.sky[1]);
    b.style.setProperty('--g2', grade.sky[2]);
    b.addEventListener('click', () => {
      state.grade = key;
      [...gradeBar.children].forEach((c) => c.classList.toggle('on', c === b));
      redraw();
    });
    gradeBar.appendChild(b);
  }
  for (const [key, size] of Object.entries(SIZES)) {
    const o = document.createElement('option');
    o.value = key; o.textContent = size.label;
    sizeSelect.appendChild(o);
  }
  sizeSelect.value = state.size;
}

function wireEvents() {
  titleInput.addEventListener('input', () => { state.title = titleInput.value; redraw(); });
  subtitleInput.addEventListener('input', () => { state.subtitle = subtitleInput.value; redraw(); });
  badgeInput.addEventListener('input', () => { state.badge = badgeInput.value; redraw(); });
  sizeSelect.addEventListener('change', () => { state.size = sizeSelect.value; redraw(); });
  document.getElementById('stars').addEventListener('input', (e) => {
    state.stars = Number(e.target.value);
    document.getElementById('starsOut').textContent = '★'.repeat(state.stars);
    redraw();
  });
  photoSelect.addEventListener('change', () => {
    state.panels[state.selected].img = photoSelect.value;
    redraw();
  });
  zoomInput.addEventListener('input', () => { state.panels[state.selected].zoom = Number(zoomInput.value); redraw(); });
  panXInput.addEventListener('input', () => { state.panels[state.selected].ox = Number(panXInput.value); redraw(); });
  panYInput.addEventListener('input', () => { state.panels[state.selected].oy = Number(panYInput.value); redraw(); });
  document.getElementById('fillAll').addEventListener('click', () => {
    const img = state.panels[state.selected].img;
    state.panels.forEach((p) => { p.img = img; });
    refreshPanelControls();
    redraw();
    status.textContent = 'Every panel now uses the same photo.';
  });
  document.getElementById('shuffle').addEventListener('click', () => {
    const keys = Object.keys(SAMPLES).concat(Object.keys(uploads));
    state.panels.forEach((p) => { p.img = keys[Math.floor(Math.random() * keys.length)]; });
    refreshPanelControls();
    redraw();
  });
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const key = `up${Date.now()}`;
    const url = URL.createObjectURL(file);
    images[key] = await loadImage(url);
    uploads[key] = { label: `Your photo: ${file.name}`, url };
    state.panels[state.selected].img = key;
    refreshPanelControls();
    redraw();
    status.textContent = `Loaded ${file.name} into panel ${state.selected + 1}.`;
  });
  document.getElementById('export').addEventListener('click', () => {
    const size = SIZES[state.size];
    const off = document.createElement('canvas');
    off.width = size.w; off.height = size.h;
    drawCover(off, { ...state, panels: currentPanels() });
    off.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `vice-coast-${state.size}.png`;
      a.click();
      status.textContent = `Saved vice-coast-${state.size}.png (${size.w} x ${size.h}).`;
    }, 'image/png');
  });
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * canvas.width;
    const y = (e.clientY - rect.top) / rect.height * canvas.height;
    const rects = layoutPanels(state.layout, canvas.width, canvas.height);
    const hit = rects.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
    if (hit >= 0) {
      state.selected = hit;
      refreshPanelControls();
      redraw();
    }
  });
  window.addEventListener('resize', highlightSelectedPanel);
}

/** Fills the nine panel slots, alternating the two samples. Called at start. */
export async function initEditor() {
  for (const [key, s] of Object.entries(SAMPLES)) images[key] = await loadImage(s.url);
  const keys = Object.keys(SAMPLES);
  state.panels = Array.from({ length: 9 }, (_, i) => ({
    img: keys[i % keys.length], zoom: 1, ox: 0, oy: 0,
  }));
  buildToolbar();
  wireEvents();
  refreshPanelControls();
  redraw();
}

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShot(shot, new URLSearchParams(location.search), {
    state, images, SAMPLES, redraw, refreshPanelControls, initEditor, loadImage,
  });
} else {
  initEditor();
}
