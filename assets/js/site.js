// H, the final options: palette engine, reveals, the surface words, collections, the render strip.
document.documentElement.classList.add('js');
(() => {
  const PAL = { red:'#FF3F56', pink:'#FE52B9', purple:'#BE3DFF', indigo:'#7370FF', blue:'#26BBFF', teal:'#44DAC1', green:'#46C862', lime:'#A9D34F', yellow:'#FFC229', orange:'#FF8F1F', vermilion:'#FD6535', clay:'#B2705C' };
  const ALL = Object.values(PAL), p = PAL;
  const WARM = [p.red, p.vermilion, p.orange, p.yellow, p.clay, p.pink, p.yellow, p.orange, p.vermilion, p.red, p.clay, p.orange];
  const COOL = [p.blue, p.teal, p.green, p.lime, p.indigo, p.purple, p.teal, p.blue, p.indigo, p.lime, p.green, p.blue];
  const PRESETS = {
    spectrum: { name:'Spectrum', bg:'#000000', bg2:'#202124', ink:'#FFFFFF', mute:'#AAAAAE', c:[p.yellow, p.pink, p.blue, p.lime], w:[p.green, p.lime, p.orange, p.blue, p.pink, p.indigo], o:ALL, pool:ALL },
    deck: { name:'Deck', bg:'#000000', bg2:'#202124', ink:'#FFFFFF', mute:'#AAAAAE', c:[p.blue, p.pink, p.purple, p.indigo], w:[p.blue, p.teal, p.pink, p.indigo, p.purple, p.red], o:ALL, pool:[p.blue, p.pink, p.purple, p.indigo, p.teal, p.red] },
    ember: { name:'Ember', bg:'#0B0908', bg2:'#1D1816', ink:'#F7F0EA', mute:'#A99C94', c:[p.orange, p.vermilion, p.yellow, p.clay], w:[p.yellow, p.orange, p.vermilion, p.red, p.clay, p.pink], o:WARM, pool:[p.red, p.vermilion, p.orange, p.yellow, p.clay, p.pink] },
    tide: { name:'Tide', bg:'#03080A', bg2:'#111A1E', ink:'#EEF7F8', mute:'#93A4AB', c:[p.teal, p.blue, p.lime, p.indigo], w:[p.green, p.lime, p.teal, p.blue, p.indigo, p.purple], o:COOL, pool:[p.blue, p.teal, p.green, p.lime, p.indigo, p.purple] },
    blocks: { name:'Blocks', bg:'#000000', bg2:'#202124', ink:'#FFFFFF', mute:'#AAAAAE', c:[p.lime, p.pink, p.yellow, p.blue], w:[p.green, p.lime, p.orange, p.blue, p.pink, p.indigo], o:ALL, pool:ALL,
      chips:true, n:['#000000', '#000000', '#000000', '#000000'], hero:{ bg:p.indigo, ink:'#000000', mute:'rgba(0,0,0,.72)' }, num:{ bg:p.yellow, ink:'#000000' }, ct:{ bg:p.pink, ink:'#000000', mute:'rgba(0,0,0,.66)' } },
    // Paper: the whole slide palette. Where a colour is used for text, the CSS deepens it (site.css), so yellows and greens still read on a light page
    paper: { name:'Paper', bg:'#F3F3F3', bg2:'#E4E4E6', ink:'#0A0A0A', mute:'#5E5E63', line:'rgba(0,0,0,.13)', shadow:'rgba(0,0,0,.28)', c:[p.indigo, p.green, p.vermilion, p.yellow], w:[p.indigo, p.green, p.yellow, p.blue, p.vermilion, p.purple], o:ALL, pool:ALL, light:true }
  };
  // the site offers two themes and a shuffle; the other presets stay defined for the older concept pages
  const ORDER = ['paper', 'spectrum'];
  const TOKENS = ['bg','bg2','ink','mute','line','shadow','c1','c2','c3','c4','k1','k2','k3','k4','kb1','kb2','kb3','kb4','n1','n2','n3','n4','w1','w2','w3','w4','w5','w6','o1','o2','o3','o4','o5','o6','o7','o8','o9','o10','o11','o12','hero-bg','hero-ink','hero-mute','num-bg','num-ink','ct-bg','ct-ink','ct-mute'];
  const root = document.documentElement, css = getComputedStyle(root);
  if (window.CSS && CSS.registerProperty) {
    TOKENS.forEach(t => { try { CSS.registerProperty({ name:'--' + t, syntax:'<color>', inherits:true, initialValue: css.getPropertyValue('--' + t).trim() || '#000' }); } catch (e) {} });
    root.style.transition = TOKENS.map(t => '--' + t + ' .7s cubic-bezier(.2,.7,.2,1)').join(',');
  }
  const TRANS = root.style.transition;
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  function wipe(ev, fn) {
    if (!document.startViewTransition || still.matches) return fn();
    const x = ev && ev.clientX ? ev.clientX : innerWidth / 2, y = ev && ev.clientY ? ev.clientY : innerHeight / 2;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.style.transition = 'none';
    const t = document.startViewTransition(fn);
    t.ready.then(() => root.animate({ clipPath:['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + r + 'px at ' + x + 'px ' + y + 'px)'] }, { duration:950, easing:'cubic-bezier(.65,.05,.3,1)', pseudoElement:'::view-transition-new(root)' })).catch(() => {});
    t.finished.finally(() => { root.style.transition = TRANS; });
  }
  let state = null;
  function build(pr) {
    const v = { bg:pr.bg, bg2:pr.bg2, ink:pr.ink, mute:pr.mute, line:pr.line || (pr.light ? 'rgba(0,0,0,.13)' : 'rgba(255,255,255,.14)'), shadow:pr.shadow || 'rgba(0,0,0,.7)' };
    pr.c.forEach((x, i) => { const n = i + 1; v['c' + n] = x; v['k' + n] = pr.chips ? '#000000' : x; v['kb' + n] = pr.chips ? x : 'transparent'; v['n' + n] = pr.n ? pr.n[i] : x; });
    pr.w.forEach((x, i) => v['w' + (i + 1)] = x);
    pr.o.forEach((x, i) => v['o' + (i + 1)] = x);
    const h = pr.hero || {}, nm = pr.num || {}, ct = pr.ct || {};
    v['hero-bg'] = h.bg || pr.bg; v['hero-ink'] = h.ink || pr.ink; v['hero-mute'] = h.mute || pr.mute;
    v['num-bg'] = nm.bg || pr.bg; v['num-ink'] = nm.ink || pr.ink;
    v['ct-bg'] = ct.bg || pr.bg; v['ct-ink'] = ct.ink || pr.ink; v['ct-mute'] = ct.mute || pr.mute;
    return { key:pr.key, v, chips:!!pr.chips, ptc:pr.ptc || '', light:!!pr.light, pool:pr.pool };
  }
  function paint() {
    Object.entries(state.v).forEach(([k, x]) => root.style.setProperty('--' + k, x));
    root.style.colorScheme = state.light ? 'light' : 'dark';
    root.style.setProperty('--ptc', state.ptc || 'var(--pc)');
    root.classList.toggle('chips', state.chips);
    root.classList.toggle('light', state.light);
    document.querySelectorAll('.pre').forEach(b => b.classList.toggle('on', b.dataset.k === state.key));
    document.querySelectorAll('.theme [data-theme]').forEach(b => { const on = b.dataset.theme === state.key; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    try { localStorage.setItem('hn-theme', JSON.stringify(state)); } catch (e) {}
  }
  function use(key) { PRESETS[key].key = key; state = build(PRESETS[key]); paint(); }
  function setAccent(i, x) {
    const v = state.v; v['c' + i] = x; v['n' + i] = state.chips ? '#000000' : x;
    if (state.chips) v['kb' + i] = x; else v['k' + i] = x;
  }
  function shuffle() {
    const pool = (state.pool || ALL).filter(x => x.toLowerCase() !== state.v.bg.toLowerCase());
    const pick = pool.slice().sort(() => Math.random() - .5);
    for (let i = 1; i <= 4; i++) setAccent(i, pick[(i - 1) % pick.length]);
    // section colours: any of the twelve
    const w = ALL.slice().sort(() => Math.random() - .5);
    for (let i = 1; i <= 6; i++) state.v['w' + i] = w[i - 1];
    state.key = null; paint();
  }
  window.gfx = {
    get v() { return state.v; },
    shuffle: ev => wipe(ev, shuffle),
    shuffleNow: shuffle,
    lead: (hex, ev) => wipe(ev, () => { setAccent(1, hex); state.key = null; paint(); })
  };

  // the choosing tool: palettes, and links between the options
  const lab = document.getElementById('lab');
  if (lab) {
    const preBox = document.getElementById('presets');
    if (preBox) ORDER.forEach((k, i) => {
      const pr = PRESETS[k], b = document.createElement('button');
      b.className = 'pre'; b.dataset.k = k; b.title = pr.name + ' (' + (i + 1) + ')';
      b.innerHTML = '<span class="sw"><i style="background:' + ((pr.hero && pr.hero.bg) || pr.bg) + '"></i>' + pr.c.map(x => '<i style="background:' + x + '"></i>').join('') + '</span>' + pr.name;
      b.addEventListener('click', e => wipe(e, () => use(k)));
      preBox.appendChild(b);
    });
    const shBtn = document.getElementById('shuffle');
    if (shBtn) shBtn.addEventListener('click', e => wipe(e, shuffle));
    const minBtn = document.getElementById('labMin');
    minBtn.addEventListener('click', () => { const m = lab.classList.toggle('min'); minBtn.textContent = m ? 'Show' : 'Hide'; });
    document.addEventListener('keydown', e => {
      if ((e.target.closest && e.target.closest('input,textarea')) || e.metaKey || e.ctrlKey || e.altKey) return;
      const n = +e.key; if (n >= 1 && n <= ORDER.length) wipe(null, () => use(ORDER[n - 1]));
      if (e.key === 's' || e.key === 'S') wipe(null, shuffle);
    });
  }
  const q = new URLSearchParams(location.search);
  // the switch in the nav: Paper, Spectrum, or a shuffle of the current one's accents
  document.querySelectorAll('.theme [data-theme]').forEach(b => b.addEventListener('click', e => wipe(e, () => use(b.dataset.theme))));
  document.querySelectorAll('.theme .sh').forEach(b => b.addEventListener('click', e => wipe(e, shuffle)));
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem('hn-theme') || 'null'); } catch (e) {}
  if (q.get('p') && PRESETS[q.get('p')]) use(q.get('p'));
  else if (saved && saved.key && PRESETS[saved.key]) use(saved.key);   // a named theme: rebuild it, so changes to it show up
  else if (saved && saved.v) { state = saved; paint(); }
  else use('paper');
  if (lab && q.get('lab') === '0') lab.hidden = true;

  // reveal on scroll
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin:'0px 0px -8% 0px' });
  document.querySelectorAll('.rv').forEach(el => io.observe(el));

  // words cut from renders: on by default, a switch to turn them off, click a word for another surface
  const SURF = { redsoil:'Red soil', slate:'Slate', pale:'Layered rock', lichen:'Lichen on rock', snow:'Snow', basalt:'Basalt' };
  const KEYS = Object.keys(SURF);
  const hero = document.querySelector('.hero');
  const words = [...document.querySelectorAll('.hero .tx')];
  const note = document.getElementById('surfNote');
  const setSurf = (el, k) => { el.dataset.s = k; el.style.setProperty('--s', 'url("' + new URL('fx/fill2/' + k + '.webp', location.href) + '")'); };
  words.forEach(el => setSurf(el, el.dataset.s));
  const showNote = () => { if (note) note.textContent = words.map(w => SURF[w.dataset.s]).join(', ') + '. Cut from renders I made of Icelandic scans in 2019. Click a word for another.'; };
  showNote();
  function surfaces(on) {
    hero && hero.classList.toggle('surf', on);
    document.querySelectorAll('#surfSeg button').forEach(b => b.classList.toggle('on', (b.dataset.v === '1') === on));
    if (note) note.hidden = !on;
    try { localStorage.setItem('h-surf', on ? '1' : '0'); } catch (e) {}
  }
  let on = true;
  try { on = localStorage.getItem('h-surf') !== '0'; } catch (e) {}
  surfaces(on);
  document.querySelectorAll('#surfSeg button').forEach(b => b.addEventListener('click', () => surfaces(b.dataset.v === '1')));
  words.forEach(el => el.addEventListener('click', () => {
    if (!hero.classList.contains('surf')) return;
    const used = words.map(w => w.dataset.s);
    const next = KEYS.filter(k => !used.includes(k));
    setSurf(el, next[(next.indexOf(el.dataset.s) + 1 + Math.floor(Math.random() * next.length)) % next.length]);
    showNote();
  }));
  if (hero && matchMedia('(hover: hover)').matches) hero.addEventListener('pointermove', e => {
    words.forEach(t => {
      const r = t.getBoundingClientRect();
      t.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      t.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  // collections: hover or focus a name to show it, click the picture to see it full size
  const clb = document.getElementById('collLb');
  document.querySelectorAll('.coll').forEach(box => {
    const btns = [...box.querySelectorAll('.coll-list button')], frame = box.querySelector('.frame');
    const name = box.querySelector('.coll-view b'), meta = box.querySelector('.coll-view figcaption span');
    const imgs = new Map();
    let cur = 0;
    function show(b) {
      cur = btns.indexOf(b);
      btns.forEach(x => x.classList.toggle('on', x === b));
      let img = imgs.get(b);
      if (!img) { img = new Image(); img.alt = ''; img.decoding = 'async'; img.src = b.dataset.img; frame.appendChild(img); imgs.set(b, img); }
      const done = () => imgs.forEach(x => x.classList.toggle('on', x === img));
      img.complete ? done() : img.addEventListener('load', done, { once:true });
      name.textContent = b.querySelector('span').textContent;
      meta.textContent = b.dataset.k;
    }
    btns.forEach(b => { b.addEventListener('pointerenter', () => show(b)); b.addEventListener('focus', () => show(b)); b.addEventListener('click', () => show(b)); });
    show(btns[0]);
    if (!clb) return;
    let data = {};
    try { data = JSON.parse(document.getElementById('collData').textContent); } catch (e) {}
    const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    const open = i => {
      const b = btns[(i + btns.length) % btns.length];
      show(b);
      const slug = b.dataset.slug, d = data[slug] || { assets: [] }, name = b.querySelector('span').textContent;
      clb.querySelector('.cv-top b').textContent = name;
      clb.querySelector('.cv-top span').textContent = b.dataset.k + ' · ' + (d.count || d.assets.length) + ' assets · ' + (cur + 1) + ' of ' + btns.length;
      const ban = clb.querySelector('.cv-banner'); ban.src = b.dataset.xl; ban.alt = name;
      clb.querySelector('.cv-sub').textContent = d.sub || '';
      clb.querySelector('.cv-grid').innerHTML = d.assets.map(x => '<figure class="' + (x.k === '3d' ? 'obj' : '') + '"><img loading="lazy" decoding="async" src="img/coll/assets/' + slug + '/' + x.f + '.webp" alt="' + esc(x.n) + '"><figcaption>' + esc(x.n) + '</figcaption></figure>').join('');
      clb.querySelector('.cv-more span').textContent = d.assets.length < d.count ? 'Showing ' + d.assets.length + ' of ' + d.count + '.' : 'All ' + d.assets.length + ' assets.';
      const link = clb.querySelector('.cv-more a'); link.href = d.url || 'https://quixel.com/megascans/collections';
      if (!clb.open) clb.showModal();
      clb.scrollTop = 0;
    };
    frame.addEventListener('click', () => open(cur));
    addEventListener('hn:collection', e => { const i = btns.findIndex(x => x.dataset.slug === e.detail); if (i >= 0) open(i); });
    clb.querySelectorAll('.cv-ctl [data-d]').forEach(n => n.addEventListener('click', () => open(cur + +n.dataset.d)));
    clb.querySelector('.cv-x').addEventListener('click', () => clb.close());
    clb.addEventListener('click', e => { if (e.target === clb) clb.close(); });
    document.addEventListener('keydown', e => {
      if (!clb.open) return;
      if (e.key === 'ArrowRight') open(cur + 1);
      if (e.key === 'ArrowLeft') open(cur - 1);
    });
  });

  // the light render strip: duplicate the row so it loops, open a render in the lightbox
  const lb = document.querySelector('.lb');
  document.querySelectorAll('.strip-row').forEach(row => {
    const items = [...row.children];
    items.forEach(b => { const c = b.cloneNode(true); c.tabIndex = -1; c.setAttribute('aria-hidden', 'true'); row.appendChild(c); });
    row.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || !lb) return;
      lb.querySelector('img').src = 'img/reel/' + b.dataset.f + '.webp';
      lb.querySelector('p').textContent = b.dataset.n;
      if (!lb.open) lb.showModal();
    });
  });
  if (lb) lb.addEventListener('click', () => lb.close());
})();
