// Fixed scenes for screenshots: ?shot=editor shows the page with a sample
// photo loaded; ?shot=cover shows the exported cover alone, full frame.
// Query knobs: photo / photo2 (sample keys), caption (title), subtitle,
// layout, grade, size (1080x1080, 1080x1350, 1920x1080). window.__shotReady
// is set once the fonts are in and the cover has painted twice.
export async function runShot(shot, query, ctx) {
  const { state, images, SAMPLES, redraw, refreshPanelControls, initEditor, loadImage } = ctx;
  if (shot === 'cover') document.body.classList.add('shot-cover');
  await initEditor();
  const get = (k, d) => query.get(k) ?? d;
  state.layout = get('layout', state.layout);
  state.grade = get('grade', state.grade);
  state.size = get('size', state.size);
  state.title = get('caption', state.title);
  state.subtitle = get('subtitle', state.subtitle);
  state.badge = get('badge', state.badge);
  const first = get('photo', 'pier');
  const second = get('photo2', 'boulevard');
  const keys = [first, second].filter((k) => SAMPLES[k]);
  state.panels.forEach((p, i) => { p.img = keys[i % keys.length]; });
  const titleEl = document.getElementById('title');
  const subEl = document.getElementById('subtitle');
  const badgeEl = document.getElementById('badge');
  const sizeEl = document.getElementById('size');
  if (titleEl) titleEl.value = state.title;
  if (subEl) subEl.value = state.subtitle;
  if (badgeEl) badgeEl.value = state.badge;
  if (sizeEl) sizeEl.value = state.size;
  document.querySelectorAll('#layouts button').forEach((b) =>
    b.classList.toggle('on', b.dataset.layout === state.layout));
  document.querySelectorAll('#grades button').forEach((b) =>
    b.classList.toggle('on', b.dataset.grade === state.grade));
  refreshPanelControls();
  redraw();
  try {
    await document.fonts.load('100px Anton');
    await document.fonts.load('60px Pacifico');
    await document.fonts.ready;
  } catch { /* fall back to system fonts; the cover still draws */ }
  redraw();
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
