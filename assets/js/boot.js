// Start each live piece when it nears the screen, or only when asked (a .gate with a poster and a button).
// A plain script: the warp needs nothing else; the reel imports three.js, which browsers only allow over http.
(() => {
  // plain scripts: [files, loaded in order, the function the last one defines]
  // the page links this file with ?v=<build>; pass that on so a reload never runs an old copy
  const V = document.currentScript ? new URL(document.currentScript.src).search : '';
  const PLAIN = { warp: [['assets/fx/warp2.js'], 'hnWarp'], pillars: [['assets/fx/glkit.js', 'assets/fx/pillars.js'], 'hnPillars'] };
  const loaded = {};
  const load = src => loaded[src] || (loaded[src] = new Promise((ok, no) => {
    const s = document.createElement('script'); s.src = /^https?:/.test(src) ? src : src + V; s.onload = ok; s.onerror = no; document.head.appendChild(s);
  }));
  const ready = ([srcs, fn]) => window[fn] ? Promise.resolve() : srcs.reduce((p, src) => p.then(() => load(src)), Promise.resolve());
  const start = el => {
    const plain = PLAIN[el.dataset.fx];
    if (plain) return ready(plain).then(() => window[plain[1]](el));
    return import('../fx/' + el.dataset.fx + '.js' + V).then(m => m.default(el)).catch(err => {
      console.error(el.dataset.fx, err);
      const load = el.querySelector('.s-load');
      if (load && location.protocol === 'file:') load.textContent = 'Opened from disk, so the browser blocks the 3D reel. Open it from localhost:8000 instead.';
    });
  };
  document.querySelectorAll('[data-fx]').forEach(el => {
    const gate = el.closest('.gate');
    if (gate) {
      gate.querySelector('.gate-go').addEventListener('click', () => { gate.classList.add('live'); start(el); }, { once: true });
      return;
    }
    const io = new IntersectionObserver(es => {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      start(el);
    }, { rootMargin: '300px 0px' });
    io.observe(el);
  });
})();
