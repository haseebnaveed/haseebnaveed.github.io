// Shared bits for the lab experiments.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export { THREE };
export const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
export const pal = () => (window.gfx ? window.gfx.v : {});

const cache = new Map();
export const col = hex => {
  if (!cache.has(hex)) { const c = new THREE.Color(1, 1, 1); if (/^#[0-9a-f]{6}$/i.test(hex || '')) c.set(hex); cache.set(hex, c); }
  return cache.get(hex);
};

export function makeRenderer(canvas, { alpha = true, dpr = 2 } = {}) {
  const r = new THREE.WebGLRenderer({ canvas, alpha, antialias: true });
  r.setPixelRatio(Math.min(devicePixelRatio, dpr));
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.NeutralToneMapping;
  r.setClearColor(0x000000, 0);
  return r;
}

export function studio(renderer, scene) {
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  pm.dispose();
}

// Megascans surfaces from the old Unreal render project; the number is the mean albedo, used to normalise the dye
export const MATS = [
  ['ash', .628], ['sfabric', .257], ['walnut', .389], ['fl2', .569],
  ['studded', .069], ['soil', .48], ['fl4', .285], ['needles', .29],
  ['hex', .416], ['fleather', .19], ['mosaic', .389], ['fl3', .234]
];

// mesh converted from the scan's FBX: 'HNM1', int16 positions, int8 normals, float uvs, uint32 indices
export async function loadMesh(url, progress = () => {}) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.status);
  const total = +res.headers.get('content-length') || 0, reader = res.body.getReader(), parts = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value); got += value.length;
    if (total) progress(Math.round(got / total * 100));
  }
  const buf = new Uint8Array(got);
  let o = 0;
  parts.forEach(p => { buf.set(p, o); o += p.length; });
  const dv = new DataView(buf.buffer);
  if (dv.getUint32(0, true) !== 0x314D4E48) throw new Error('bad mesh');
  const vc = dv.getUint32(4, true), ic = dv.getUint32(8, true);
  o = 28;
  const pos = new Int16Array(buf.buffer, o, vc * 3); o += vc * 6; o = (o + 3) & ~3;
  const nrm = new Int8Array(buf.buffer, o, vc * 4); o += vc * 4;
  const uv = new Float32Array(buf.buffer, o, vc * 2); o += vc * 8;
  const idx = new Uint32Array(buf.buffer, o, ic);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3, true));
  g.setAttribute('normal', new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(nrm, 4), 3, 0, true));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}
let rockGeo = null;
export const rock = progress => (rockGeo ||= loadMesh('fx/rock/rock.bin', progress));

// run frame(dt, t) every animation frame while el is on screen and the tab is visible
export function loop(el, frame) {
  let visible = false, raf = 0, last = performance.now();
  const tick = now => {
    raf = 0;
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    frame(dt, now / 1000);
    go();
  };
  const go = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(tick); };
  new IntersectionObserver(es => { visible = es[0].isIntersecting; go(); }).observe(el);
  document.addEventListener('visibilitychange', go);
  return go;
}

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
