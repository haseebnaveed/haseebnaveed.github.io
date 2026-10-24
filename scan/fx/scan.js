// 1. Scan to asset: scroll drives capture, point cloud, mesh and textures on the real rock.
import { THREE, makeRenderer, studio, rock, loop, pal, col, still, clamp, smooth } from './common.js';

export default function scan(track) {
  const stage = track.querySelector('.scan-stage'), canvas = stage.querySelector('canvas');
  const steps = [...track.querySelectorAll('#scanSteps li')];
  const hint = document.getElementById('scanHint'), load = document.getElementById('scanLoad');
  let renderer;
  try { renderer = makeRenderer(canvas); } catch (e) { load.textContent = 'This browser cannot show 3D'; return; }
  renderer.localClippingEnabled = true;
  const scene = new THREE.Scene();
  studio(renderer, scene);
  scene.environmentIntensity = .5;
  const cam = new THREE.PerspectiveCamera(30, 1, .05, 60);
  cam.position.set(0, .95, 5.8);
  cam.lookAt(0, .02, 0);
  scene.add(cam);
  const key = new THREE.DirectionalLight(0xffffff, 2.1); key.position.set(2.5, 3, 2.5);
  const rim = new THREE.DirectionalLight(0xffffff, .9); rim.position.set(-3, 2, -3);
  cam.add(key, rim);

  const turn = new THREE.Group();
  scene.add(turn);
  const obj = new THREE.Group();
  obj.rotation.x = -Math.PI / 2; // the FBX sat under a -90 degree up-axis node
  obj.scale.setScalar(1.42);
  obj.position.y = -.08;
  turn.add(obj);

  // the capture rig: three rings of cameras that flash as the photos are taken
  // (none on the side facing us, so they never sit between you and the rock)
  const RINGS = [[-.08, 18, 1.92], [.45, 18, 1.82], [.98, 14, 1.6]];
  const rigCams = [];
  RINGS.forEach(([el, n, rad], k) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + k * .3;
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < .85) continue;
      rigCams.push(new THREE.Vector3(Math.sin(a) * Math.cos(el) * rad, Math.sin(el) * rad + .05, Math.cos(a) * Math.cos(el) * rad));
    }
  });
  const F = [[0, 0, 0], [.1, .066, .2], [-.1, .066, .2], [-.1, -.066, .2], [.1, -.066, .2]];
  const EDGES = [[0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [2, 3], [3, 4], [4, 1]];
  const rigPos = new Float32Array(rigCams.length * 16 * 3), rigCol = new Float32Array(rigCams.length * 16 * 4);
  const dummy = new THREE.Object3D(), tmp = new THREE.Vector3();
  rigCams.forEach((p, c) => {
    dummy.position.copy(p); dummy.lookAt(0, .05, 0); dummy.updateMatrix();
    EDGES.forEach(([a, b], e) => {
      [a, b].forEach((v, j) => { tmp.fromArray(F[v]).applyMatrix4(dummy.matrix); tmp.toArray(rigPos, (c * 16 + e * 2 + j) * 3); });
    });
  });
  const rigGeo = new THREE.BufferGeometry();
  rigGeo.setAttribute('position', new THREE.BufferAttribute(rigPos, 3));
  const rigColAttr = new THREE.BufferAttribute(rigCol, 4);
  rigGeo.setAttribute('color', rigColAttr);
  const rig = new THREE.LineSegments(rigGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, toneMapped: false }));
  scene.add(rig);
  // the flash itself: a soft dot at each camera
  const flashGeo = new THREE.BufferGeometry();
  flashGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(rigCams.flatMap(p => [p.x, p.y, p.z])), 3));
  const flashA = new Float32Array(rigCams.length);
  flashGeo.setAttribute('aF', new THREE.BufferAttribute(flashA, 1));
  const flashMat = new THREE.ShaderMaterial({
    uniforms: { uDpr: { value: renderer.getPixelRatio() } },
    vertexShader: `attribute float aF; varying float vF; uniform float uDpr;
      void main(){ vF = aF; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = (14. + 46. * aF) * uDpr * 3. / -mv.z; }`,
    fragmentShader: `varying float vF; void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, 0., d); gl_FragColor = vec4(vec3(1.), a * a * vF); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  scene.add(new THREE.Points(flashGeo, flashMat));

  // turntable ring under the rock
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .22, toneMapped: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.32, 1.335, 160), ringMat);
  ring.rotation.x = -Math.PI / 2;
  scene.add(ring);

  // sweep planes, in world space
  const hW = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);  // keep below the wire sweep
  const hT = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);   // keep above the texture sweep
  const hT2 = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0); // keep below the texture sweep
  const bW = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), bT = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  const tl = new THREE.TextureLoader();
  const T = (u, srgb) => { const t = tl.load(u, () => { loaded++; ready(); }); t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  let loaded = 0, geo = null;
  const A = T('fx/rock/rock_a.jpg', true), N = T('fx/rock/rock_n.jpg'), R = T('fx/rock/rock_r.jpg');

  const wireBase = new THREE.MeshBasicMaterial({ color: 0x202124, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, clippingPlanes: [hW, hT] });
  const wireLines = new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: .3, toneMapped: false, clippingPlanes: [hW, hT] });
  const lit = new THREE.MeshStandardMaterial({ map: A, normalMap: N, roughnessMap: R, normalScale: new THREE.Vector2(1, -1), clippingPlanes: [hT2] });
  const off = { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 };
  const bandW = new THREE.MeshBasicMaterial({ toneMapped: false, side: THREE.DoubleSide, clippingPlanes: [hW, bW], ...off });
  const bandT = new THREE.MeshBasicMaterial({ toneMapped: false, side: THREE.DoubleSide, clippingPlanes: [hT2, bT], ...off });

  const pts = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: A }, uTint: { value: new THREE.Color() }, uCol: { value: 0 }, uDens: { value: 0 }, uConv: { value: 0 }, uTime: { value: 0 }, uClip: { value: -9 }, uSize: { value: 11 }, uDpr: { value: renderer.getPixelRatio() } },
    vertexShader: `
      uniform float uSize, uDens, uConv, uTime, uDpr;
      attribute vec4 aRnd;
      varying vec2 vUv; varying float vOn; varying float vY; varying float vC;
      void main(){
        vUv = uv;
        float c = clamp(uConv * 1.7 - aRnd.w * .7, 0., 1.);
        c = c * c * (3. - 2. * c);
        vC = c;
        vec3 p = position + aRnd.xyz * (1. - c) * .85 + aRnd.xyz * sin(uTime * 1.4 + aRnd.w * 40.) * .02 * (1. - c);
        vec4 wp = modelMatrix * vec4(p, 1.);
        vY = wp.y;
        vec4 mv = viewMatrix * wp;
        gl_Position = projectionMatrix * mv;
        vOn = step(aRnd.w, uDens);
        gl_PointSize = uSize * uDpr * (1. + (1. - c) * .9) / -mv.z;
      }`,
    fragmentShader: `
      uniform sampler2D uMap; uniform vec3 uTint; uniform float uCol, uClip;
      varying vec2 vUv; varying float vOn; varying float vY; varying float vC;
      void main(){
        if (vOn < .5 || vY < uClip) discard;
        vec2 d = gl_PointCoord - .5;
        if (dot(d, d) > .25) discard;
        vec3 a = texture2D(uMap, vUv).rgb * 1.6;
        gl_FragColor = vec4(mix(uTint, a, uCol * vC), 1.);
        #include <colorspace_fragment>
      }`
  });

  let y0 = -.6, y1 = .6, ok = false;
  rock(p => { load.textContent = 'Loading the scan, ' + p + '%'; }).then(g => {
    geo = g;
    const n = g.attributes.position.count, rnd = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u), r = .35 + Math.random() * .65;
      rnd[i * 4] = Math.cos(a) * s * r; rnd[i * 4 + 1] = Math.sin(a) * s * r; rnd[i * 4 + 2] = u * r; rnd[i * 4 + 3] = Math.random();
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', g.attributes.position);
    pg.setAttribute('uv', g.attributes.uv);
    pg.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 4));
    const cloud = new THREE.Points(pg, pts);
    cloud.frustumCulled = false;
    const base = new THREE.Mesh(g, wireBase), lines = new THREE.Mesh(g, wireLines), solid = new THREE.Mesh(g, lit);
    const b1 = new THREE.Mesh(g, bandW), b2 = new THREE.Mesh(g, bandT);
    obj.add(cloud, base, lines, solid, b1, b2);
    turn.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(solid);
    y0 = box.min.y - .02; y1 = box.max.y + .02;
    ring.position.y = box.min.y + .01;
    loaded++; ready();
  }).catch(() => { load.textContent = 'Could not load the scan'; });

  function ready() {
    if (loaded < 4 || ok) return;
    ok = true;
    load.classList.add('done');
    if (play) setPlaying(true);
    kick();
  }

  let W = 1, H = 1;
  function size() {
    W = stage.clientWidth; H = stage.clientHeight;
    renderer.setSize(W, H, false);
    const narrow = W < 1000;
    cam.aspect = W / H;
    cam.fov = narrow ? (W < H ? 44 : 36) : 29;
    if (narrow) cam.setViewOffset(W, H, 0, H * .1, W, H); else cam.setViewOffset(W, H, -W * .175, 0, W, H);
    cam.updateProjectionMatrix();
    pts.uniforms.uDpr.value = flashMat.uniforms.uDpr.value = renderer.getPixelRatio();
  }
  new ResizeObserver(size).observe(stage);
  size();

  const white = new THREE.Color(1, 1, 1), dim = new THREE.Color(), tint = new THREE.Color(), band = new THREE.Color();
  // two ways to drive it: scrolling through a tall track, or (with .play) a play button and a scrubber
  const play = track.classList.contains('play');
  const playBtn = track.querySelector('.scan-play'), scrub = track.querySelector('.scan-scrub');
  let tp = 0, playing = false;
  function setPlaying(on) {
    if (on && tp >= 1) tp = 0;
    playing = on;
    if (playBtn) { playBtn.textContent = on ? 'Pause' : tp >= 1 ? 'Play again' : 'Play'; playBtn.setAttribute('aria-pressed', on); }
    kick();
  }
  if (playBtn) playBtn.addEventListener('click', () => setPlaying(!playing));
  if (scrub) scrub.addEventListener('input', () => { tp = +scrub.value; setPlaying(false); });

  let ps = 0, step = -1;
  const kick = loop(stage, (dt, t) => {
    let pt;
    if (play) {
      if (playing && ok) { tp = Math.min(1, tp + dt / 16); if (tp >= 1) setPlaying(false); }
      if (scrub && document.activeElement !== scrub) scrub.value = tp;
      pt = tp;
    } else {
      const r = track.getBoundingClientRect();
      pt = clamp(-r.top / Math.max(1, r.height - innerHeight));
    }
    ps += (pt - ps) * Math.min(1, dt * 7);
    const p = ps, v = pal();
    stage.style.setProperty('--p', p.toFixed(4));
    const s = p < .25 ? 0 : p < .49 ? 1 : p < .71 ? 2 : 3;
    if (s !== step) { step = s; steps.forEach((li, i) => li.classList.toggle('on', i === s)); }
    if (hint) hint.style.opacity = p > .9 ? 0 : 1;
    if (!ok) { renderer.render(scene, cam); return; }

    tint.lerp(col(v.w1), .08);
    band.copy(tint).lerp(white, .3);
    dim.copy(col(v.ink));

    // 1 capture: cameras appear and flash one after another
    const rigOn = 1 - smooth(.26, .4, p);
    rigCams.forEach((_, c) => {
      const ti = .012 + .2 * c / rigCams.length;
      const seen = smooth(ti, ti + .012, p) * rigOn;
      const fl = p > ti ? Math.exp(-(p - ti) * 90) : 0;
      flashA[c] = fl * rigOn;
      for (let k = 0; k < 16; k++) {
        const o = (c * 16 + k) * 4;
        rigCol[o] = dim.r + (tint.r - dim.r) * fl; rigCol[o + 1] = dim.g + (tint.g - dim.g) * fl; rigCol[o + 2] = dim.b + (tint.b - dim.b) * fl;
        rigCol[o + 3] = seen * (.38 + .62 * fl);
      }
    });
    rigColAttr.needsUpdate = true;
    flashGeo.attributes.aF.needsUpdate = true;
    rig.visible = rigOn > 0;

    // 2 point cloud: points arrive with the photos, then settle onto the surface and take the scan's colour
    const pu = pts.uniforms;
    pu.uDens.value = .02 + .98 * smooth(.04, .4, p);
    pu.uConv.value = smooth(.14, .47, p);
    pu.uCol.value = smooth(.32, .48, p);
    pu.uTint.value.copy(tint);
    pu.uTime.value = still ? 0 : t;

    // 3 mesh and 4 textures sweep up from the bottom
    const hw = y0 + (y1 - y0) * smooth(.5, .69, p), ht = y0 + (y1 - y0) * smooth(.72, .91, p);
    hW.constant = hw; bW.constant = -(hw - .011);
    hT.constant = -ht; hT2.constant = ht; bT.constant = -(ht - .011);
    pu.uClip.value = hw;
    const wOn = p > .49 && p < .93, tOn = p > .71;
    bandW.visible = wOn && hw < y1 - .01; bandT.visible = tOn && ht < y1 - .01;
    bandW.color.copy(band); bandT.color.copy(band);
    wireLines.color.copy(tint);
    wireBase.color.copy(col(v.bg2));
    ringMat.color.copy(dim);
    ringMat.opacity = .2 * (1 - smooth(.85, 1, p)) + .04;

    turn.rotation.y = -.5 + p * 3.4 + (still ? 0 : t * .03);
    renderer.render(scene, cam);
  });
}
