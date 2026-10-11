// 6. Render reel: every Marketplace render on one curved strip, grouped by pack. Drag and fling it; it bends with speed.
// Only the renders near the screen are loaded, and the far ones are let go again, so the page stays light.
import { THREE, makeRenderer, loop, pal, col, still } from './common.js';

const vert = `
  uniform float uX, uR, uVel;
  varying vec2 vUv; varying float vTh;
  void main(){
    vUv = uv;
    float th = (uX + position.x) / uR;
    float rad = uR - sin(uv.x * 3.14159) * uVel * .9;
    vTh = th;
    gl_Position = projectionMatrix * viewMatrix * vec4(sin(th) * rad, position.y * (1. - abs(uVel) * .05), -cos(th) * rad, 1.);
  }`;
const frag = `
  uniform sampler2D uMap; uniform float uVel, uHover, uA, uFade, uLoaded, uTime; uniform vec3 uEdge, uBase;
  varying vec2 vUv; varying float vTh;
  void main(){
    vec2 q = abs(vUv - .5) * vec2(uA, 1.), b = vec2(uA, 1.) * .5 - .03;
    float d = length(max(q - b, 0.)) - .03;
    float a = 1. - smoothstep(-fwidth(d), fwidth(d), d);
    float sh = uVel * .006;
    vec3 c = vec3(texture2D(uMap, vUv + vec2(sh, 0.)).r, texture2D(uMap, vUv).g, texture2D(uMap, vUv - vec2(sh, 0.)).b);
    // until it arrives: a soft sweep over the panel colour
    vec3 wait = uBase * (1. + .1 * smoothstep(.0, .5, .5 - abs(fract(vUv.x * .5 - uTime * .4) - .5)));
    c = mix(wait, c * (1. + uHover * .1), uLoaded);
    c = mix(uEdge, c, mix(1., smoothstep(.0, .012, -d), uHover));
    a *= 1. - smoothstep(uFade, uFade + .4, abs(vTh));
    gl_FragColor = vec4(c, a);
    #include <colorspace_fragment>
  }`;

export default async function reel(box) {
  const canvas = box.querySelector('canvas'), load = document.getElementById('reelLoad');
  const nameEl = document.getElementById('reelName'), numEl = document.getElementById('reelNum'), chapsEl = document.getElementById('reelChaps');
  const lb = document.querySelector('.lb'), lbImg = lb.querySelector('img'), lbCap = lb.querySelector('p');
  let renderer;
  try { renderer = makeRenderer(canvas); } catch (e) { load.textContent = 'This browser cannot show 3D'; return; }
  renderer.toneMapping = THREE.NoToneMapping;
  const data = await fetch('assets/fx/reel.json').then(r => r.json());
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(36, 2, .1, 60);
  const R = 10, H = 4.3, GAP = .36;

  const blank = new THREE.DataTexture(new Uint8Array([40, 40, 44, 255]), 1, 1); blank.needsUpdate = true;
  const geoCache = new Map();
  const plane = a => { const k = a.toFixed(3); if (!geoCache.has(k)) geoCache.set(k, new THREE.PlaneGeometry(H * a, H, 40, 1)); return geoCache.get(k); };
  let L = 0;
  const items = data.map((d, i) => {
    const w = H * d.a;
    const u = { uMap: { value: blank }, uX: { value: 0 }, uR: { value: R }, uVel: { value: 0 }, uHover: { value: 0 }, uA: { value: d.a }, uFade: { value: .6 },
      uLoaded: { value: 0 }, uTime: { value: 0 }, uEdge: { value: new THREE.Color() }, uBase: { value: new THREE.Color() } };
    const mesh = new THREE.Mesh(plane(d.a), new THREE.ShaderMaterial({ uniforms: u, vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false }));
    mesh.frustumCulled = false; mesh.visible = false;
    scene.add(mesh);
    const it = { i, ...d, w, at: L + w / 2, x: 0, hover: 0, u, mesh, tex: null, state: 0 };
    L += w + GAP;
    return it;
  });

  // chapters, one per pack or group of packs
  const chaps = [];
  items.forEach(it => { if (!chaps.length || chaps[chaps.length - 1].c !== it.c) chaps.push({ c: it.c, first: it.i, n: 0 }); chaps[chaps.length - 1].n++; it.ch = chaps.length - 1; });
  chaps.forEach(c => {
    const b = document.createElement('button');
    b.innerHTML = c.c + ' <span>' + c.n + '</span>';
    b.addEventListener('click', () => goTo(c.first));
    c.btn = b;
    chapsEl.appendChild(b);
  });

  // texture streaming: a few at a time, nearest first; far ones are freed
  const tl = new THREE.TextureLoader();
  let inflight = 0, ok = false;
  function stream(half) {
    const want = items.filter(it => it.state === 0 && Math.abs(it.x) < half + 14).sort((a, b) => Math.abs(a.x) - Math.abs(b.x));
    for (const it of want) {
      if (inflight >= 4) break;
      it.state = 1; inflight++;
      tl.load(`img/reel/${it.f}.webp`, t => {
        inflight--;
        t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
        if (it.state !== 1) { t.dispose(); return; }
        it.tex = t; it.u.uMap.value = t; it.state = 2;
        if (!ok) { ok = true; load.classList.add('done'); }
      }, undefined, () => { inflight--; it.state = 0; });
    }
    items.forEach(it => {
      if (it.state === 2 && Math.abs(it.x) > half + 24) { it.tex.dispose(); it.tex = null; it.u.uMap.value = blank; it.u.uLoaded.value = 0; it.state = 0; }
    });
  }

  let W = 1, Hp = 1, perPx = .01, half = 1;
  function size() {
    W = box.clientWidth; Hp = box.clientHeight;
    renderer.setSize(W, Hp, false);
    cam.aspect = W / Hp;
    cam.fov = W / Hp < 1.4 ? 30 : 36;
    cam.updateProjectionMatrix();
    perPx = 2 * R * Math.tan(cam.fov * Math.PI / 360) / Hp;
    const h = Math.atan(Math.tan(cam.fov * Math.PI / 360) * cam.aspect);
    half = h * R;
    items.forEach(it => { it.u.uFade.value = Math.max(.3, h - .3); });
  }
  new ResizeObserver(size).observe(box);
  size();

  // dragging, flinging, sideways wheel, chapter jumps, and a slow drift when left alone
  let s = items[0].at, vel = 0, drag = null, idle = 0, hoverIt = null, target = null;
  const wrap = x => ((x % L) + L * 1.5) % L - L / 2;
  function goTo(i) { target = s + wrap(items[i].at - s); vel = 0; idle = 0; kick(); }
  function under(e) {
    const r = box.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width * 2 - 1, ny = -((e.clientY - r.top) / r.height * 2 - 1);
    const d = new THREE.Vector3(nx, ny, .5).unproject(cam).normalize();
    const t = R / Math.hypot(d.x, d.z), y = d.y * t, arc = Math.atan2(d.x, -d.z) * R;
    if (Math.abs(y) > H / 2) return null;
    return items.find(it => it.mesh.visible && Math.abs(it.x - arc) < it.w / 2) || null;
  }
  canvas.addEventListener('pointerdown', e => {
    drag = { x: e.clientX, last: e.clientX, t: performance.now(), moved: 0 };
    canvas.setPointerCapture(e.pointerId);
    box.classList.add('drag');
    vel = 0; target = null;
  });
  canvas.addEventListener('pointermove', e => {
    if (drag) {
      const now = performance.now(), dx = e.clientX - drag.last, dt = Math.max(1, now - drag.t) / 1000;
      s -= dx * perPx;
      vel = vel * .5 + (-dx * perPx / dt) * .5;
      drag.last = e.clientX; drag.t = now;
      drag.moved = Math.max(drag.moved, Math.abs(e.clientX - drag.x));
      idle = 0;
    } else hoverIt = e.pointerType === 'mouse' ? under(e) : null;
    kick();
  });
  let cur = 0;
  const open = i => {
    cur = (i + items.length) % items.length;
    const it = items[cur];
    lbImg.src = `img/reel/${it.f}.webp`; lbImg.alt = it.n;
    lbCap.textContent = it.n + ', ' + it.y + '. ' + (cur + 1) + ' of ' + items.length;
    if (!lb.open) lb.showModal();
  };
  const up = e => {
    if (!drag) return;
    const d = drag; drag = null;
    box.classList.remove('drag');
    if (d.moved < 5 && e.type === 'pointerup') { const it = under(e); if (it) { vel = 0; open(it.i); } }
    if (performance.now() - d.t > 80) vel = 0;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', () => { hoverIt = null; });
  canvas.addEventListener('wheel', e => {
    const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0;
    if (!dx) return;
    e.preventDefault();
    s += dx * perPx * .9; vel = 0; idle = 0; target = null;
    kick();
  }, { passive: false });
  lb.addEventListener('click', () => lb.close());
  document.addEventListener('keydown', e => { if (!lb.open) return; if (e.key === 'ArrowRight') open(cur + 1); if (e.key === 'ArrowLeft') open(cur - 1); });

  let shown = -1, vs = 0;
  const kick = loop(box, (dt, t) => {
    idle += dt;
    if (target !== null) {
      const d = target - s;
      s += d * Math.min(1, dt * 4.5);
      vel = d * 4.5;
      if (Math.abs(d) < .01) { s = target; target = null; vel = 0; }
    } else if (!drag) {
      s += vel * dt;
      vel *= Math.exp(-dt * 2.6);
      if (idle > 2.5 && !still && !lb.open) vel += (.32 - vel) * Math.min(1, dt * .8);
    }
    vs += (Math.max(-1, Math.min(1, vel * .05)) - vs) * .15;
    const v = pal(), edge = col(v.w3), base = col(v.bg2);
    let best = null, bd = 1e9;
    items.forEach(it => {
      it.x = wrap(it.at - s);
      const vis = Math.abs(it.x) < half + it.w;
      it.mesh.visible = vis;
      if (!vis) return;
      const u = it.u;
      u.uX.value = it.x; u.uVel.value = vs; u.uTime.value = t;
      it.hover += ((it === hoverIt ? 1 : 0) - it.hover) * .15;
      u.uHover.value = it.hover;
      if (it.state === 2) u.uLoaded.value = Math.min(1, u.uLoaded.value + dt * 3);
      u.uEdge.value.copy(edge); u.uBase.value.copy(base);
      if (Math.abs(it.x) < bd) { bd = Math.abs(it.x); best = it; }
    });
    // load only once things settle, so a fling or a jump across packs does not fetch everything it passes
    if (target === null && Math.abs(vel) < 3) stream(half);
    if (best && best.i !== shown) {
      shown = best.i;
      const c = chaps[best.ch];
      nameEl.textContent = best.n;
      numEl.textContent = (best.i - c.first + 1) + ' of ' + c.n + ' in ' + c.c + ', ' + best.y;
      chaps.forEach((x, k) => x.btn.classList.toggle('on', k === best.ch));
    }
    renderer.render(scene, cam);
  });
}
