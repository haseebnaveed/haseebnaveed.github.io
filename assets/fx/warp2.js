// Carbon warp without three.js: the same two shader passes on plain WebGL2, about 9 KB with nothing else to load.
// A plain script (not a module), so it also runs when the page is opened straight from disk.
// Nebula at half resolution into a texture, then stars, warp streaks, hex grid and flash at full resolution.
// Click to warp; you arrive somewhere new and the page shuffles its colours.

(() => {
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

const vert = `attribute vec2 p; varying vec2 vUv; void main(){ vUv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
const lib = `
  precision highp float;
  varying vec2 vUv;
  float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float h11(float x){ return fract(sin(x * 127.1) * 43758.5453); }
  float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(h21(i), h21(i + vec2(1., 0.)), f.x), mix(h21(i + vec2(0., 1.)), h21(i + vec2(1., 1.)), f.x), f.y); }
  float fbm(vec2 p){ float s = 0., a = .5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for (int i = 0; i < 5; i++){ s += a * noise(p); p = m * p; a *= .5; } return s; }
`;
const nebFrag = `${lib}
  uniform vec2 uRes, uPar, uCenter; uniform float uTime, uZoom, uSeed; uniform vec3 uC1, uC2, uC3;
  void main(){
    vec2 uv = (vUv - .5) * vec2(uRes.x / uRes.y, 1.);
    vec2 p = uCenter + (uv - uCenter) / uZoom;
    p = p * 1.35 + uPar * .06 + vec2(uSeed, uSeed * .37);
    vec2 q = vec2(fbm(p + vec2(0., uTime * .012)), fbm(p + vec2(5.2, 1.3)));
    vec2 r = vec2(fbm(p + 3.4 * q + vec2(1.7, 9.2)), fbm(p + 3.4 * q + vec2(8.3, 2.8) + uTime * .009));
    float f = fbm(p + 2.6 * r);
    float mask = smoothstep(.26, .72, fbm(p * .42 + vec2(7.3, 2.1)));
    float dens = pow(smoothstep(.4, 1., f), 2.) * 2.6 * mask;
    vec3 c = mix(uC1, uC2, clamp(length(q) * 1.1 - .45, 0., 1.));
    c = mix(c, uC3, smoothstep(.5, .9, r.x));
    float lane = smoothstep(.52, .74, fbm(p * 2.2 + r * 1.6 + 11.));
    gl_FragColor = vec4((c * dens * (1. - lane * .8) + c * .014 * mask) * .85, 1.);
  }`;
const outFrag = `${lib}
  uniform sampler2D tNeb; uniform vec2 uRes, uPar, uMouse, uCenter; uniform float uTime, uWarp, uTravel, uZoom, uFlash, uSeed, uHex;
  uniform vec3 uC1, uC3;
  float stars(vec2 p, float scale, float size){
    p *= scale; vec2 id = floor(p), f = fract(p) - .5;
    float h = h21(id + uSeed);
    vec2 o = vec2(h21(id + 3.1 + uSeed), h21(id + 7.7 + uSeed)) - .5;
    float d = length(f - o * .75);
    float tw = .65 + .35 * sin(uTime * (1. + h * 3.) + h * 50.);
    return smoothstep(size, 0., d) * tw * step(.88, h) * (h - .88) * 8.3;
  }
  float hexDist(vec2 p){ p = abs(p); return max(dot(p, normalize(vec2(1., 1.732))), p.x); }
  vec4 hex(vec2 uv){
    vec2 r = vec2(1., 1.732), hh = r * .5;
    vec2 a = mod(uv, r) - hh, b = mod(uv - hh, r) - hh;
    vec2 gv = dot(a, a) < dot(b, b) ? a : b;
    return vec4(gv, uv - gv);
  }
  vec3 srgb(vec3 c){ return mix(pow(c, vec3(.41666)) * 1.055 - .055, c * 12.92, vec3(lessThanEqual(c, vec3(.0031308)))); }
  void main(){
    vec2 asp = vec2(uRes.x / uRes.y, 1.);
    vec2 uv = (vUv - .5) * asp;
    vec3 neb = vec3(0.);
    int n = uWarp > .01 ? 10 : 1;
    for (int i = 0; i < 10; i++){
      if (i >= n) break;
      float k = float(i) / 9.;
      vec2 q = uCenter + (uv - uCenter) * (1. - uWarp * .32 * k);
      neb += texture2D(tNeb, q / asp + .5).rgb;
    }
    neb /= float(n);
    vec2 sv = uCenter + (uv - uCenter) / uZoom;
    float s = stars(sv - uPar * .006, 34., .09) * .8 + stars(sv - uPar * .014 + 3.3, 17., .07) + stars(sv - uPar * .028 + 7.1, 8., .05) * 1.25;
    vec3 col = neb + vec3(s) * (1. - uWarp * .6);
    vec2 d = uv - uCenter; float rr = length(d), ang = atan(d.y, d.x);
    float N = 260.;
    float lp = (ang / 6.28318 + .5) * N, lane = floor(lp), fx = fract(lp) - .5;
    float h = h11(lane + uSeed * 13.), h2 = h11(lane * 1.7 + 3. + uSeed);
    float head = fract(h2 + uTravel * (.6 + h * 1.3)) * 1.9;
    float len = .02 + uWarp * uWarp * .95 * (.3 + h);
    float body = smoothstep(head - len, head, rr) * (1. - smoothstep(head, head + .006, rr));
    float wpx = abs(fx) * 6.28318 / N * rr * uRes.y;
    float streak = body * (1. - smoothstep(.4, 1.4, wpx)) * step(.22, h2) * smoothstep(.04, .3, rr) * uWarp;
    col += mix(vec3(1.), mix(uC1, uC3, h), .4) * streak * 2.2;
    vec2 m = uMouse * .5 * asp;
    vec4 hx = hex(uv * 15.);
    float edge = smoothstep(.03, .0, .5 - hexDist(hx.xy));
    float near = exp(-length(uv - m) * 6.5);
    float cell = step(.85, h21(floor(hx.zw * 2. + .5) + floor(uTime * 1.5))) * .16;
    col += uC3 * (edge * .3 + cell * smoothstep(.3, .7, near)) * near * uHex * (.45 + uWarp * .5);
    col += mix(uC1, vec3(1.), .5) * uFlash * (.75 - rr * .35);
    col *= 1. - smoothstep(.55, 1.25, length(uv * vec2(.85, 1.)));
    gl_FragColor = vec4(srgb(clamp(col, 0., 1.)), 1.);
  }`;

// palette hex to linear rgb, the same conversion three.js does
const lin = hex => {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  const n = m ? parseInt(m[1], 16) : 0xffffff;
  return [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
};

window.hnWarp = function warp(box) {
  const canvas = box.querySelector('canvas'), btn = box.querySelector('.warp-btn');
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) { box.classList.add('no-gl'); return; }

  const prog = fs => {
    const p = gl.createProgram();
    [[gl.VERTEX_SHADER, vert], [gl.FRAGMENT_SHADER, fs]].forEach(([t, src]) => {
      const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    });
    gl.bindAttribLocation(p, 0, 'p');
    gl.linkProgram(p);
    const u = {};
    for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
    return { p, u };
  };
  let neb, out;
  try { neb = prog(nebFrag); out = prog(outFrag); } catch (e) { console.error(e); box.classList.add('no-gl'); return; }

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  // half-resolution target for the nebula; half float where the GPU can render to it
  const half = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float');
  const tex = gl.createTexture(), fbo = gl.createFramebuffer();
  let tw = 0, th = 0, W = 1, H = 1;
  function size() {
    const pr = Math.min(devicePixelRatio, 1.5);
    W = Math.max(1, Math.round(box.clientWidth * pr)); H = Math.max(1, Math.round(box.clientHeight * pr));
    canvas.width = W; canvas.height = H;
    tw = Math.ceil(W / 2); th = Math.ceil(H / 2);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (half) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, tw, th, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tw, th, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    kick();
  }

  const S = { time: 0, zoom: 1, seed: Math.random() * 40, par: [.3, -.2], center: [0, 0], mouse: [.3, -.2], c1: lin('#fff'), c2: lin('#fff'), c3: lin('#fff'), warp: 0, travel: 0, flash: 0, hex: 0 };
  let first = true;
  const mouse = [.3, -.2];
  let hexT = 0;
  box.addEventListener('pointermove', e => {
    const r = box.getBoundingClientRect();
    mouse[0] = (e.clientX - r.left) / r.width * 2 - 1; mouse[1] = -((e.clientY - r.top) / r.height * 2 - 1);
    hexT = 1; kick();
  });
  box.addEventListener('pointerleave', () => { hexT = 0; });

  let wt = -1, shuffled = false;
  const target = [0, 0];
  function go(x, y) {
    if (wt >= 0) return;
    const r = box.getBoundingClientRect(), a = r.width / r.height;
    if (x == null) { target[0] = target[1] = 0; } else { target[0] = ((x - r.left) / r.width - .5) * a * .6; target[1] = (.5 - (y - r.top) / r.height) * .6; }
    wt = 0; shuffled = false;
    box.classList.add('go'); kick();
  }
  box.addEventListener('click', e => { if (e.target.closest('.warp-btn')) return; go(e.clientX, e.clientY); });
  if (btn) btn.addEventListener('click', e => { e.stopPropagation(); go(); });

  const easeIn = x => x * x * x, easeOut = x => 1 - Math.pow(1 - x, 3);
  const lerp = (a, b, k) => { for (let i = 0; i < a.length; i++) a[i] += (b[i] - a[i]) * k; };
  function frame(dt, t) {
    const v = window.gfx ? window.gfx.v : {};
    const k = first ? 1 : .06; first = false;
    lerp(S.c1, lin(v.c1), k); lerp(S.c2, lin(v.c2), k); lerp(S.c3, lin(v.c3), k);
    S.time = still ? 0 : t;
    let w = 0, flash = 0;
    if (wt >= 0) {
      wt += dt;
      w = wt < 1.1 ? easeIn(wt / 1.1) : wt < 1.5 ? 1 : wt < 2.7 ? 1 - easeOut((wt - 1.5) / 1.2) : 0;
      flash = Math.exp(-Math.pow((wt - 1.42) / .11, 2));
      if (wt > 1.42 && !shuffled) { shuffled = true; S.seed = Math.random() * 40; if (window.gfx) window.gfx.shuffleNow(); }
      if (wt > 2.8) { wt = -1; box.classList.remove('go'); }
    }
    S.travel += dt * (.05 + 2.6 * w * w);
    S.warp = w; S.flash = flash; S.zoom = 1 + 2.4 * w * w;
    lerp(S.center, wt >= 0 ? target : [0, 0], .08);
    lerp(S.mouse, mouse, .08);
    S.par = S.mouse;
    S.hex += (hexT - S.hex) * .06;

    const set = (P, res) => {
      const u = P.u;
      gl.useProgram(P.p);
      gl.uniform2f(u.uRes, res[0], res[1]); gl.uniform1f(u.uTime, S.time); gl.uniform1f(u.uZoom, S.zoom); gl.uniform1f(u.uSeed, S.seed);
      gl.uniform2fv(u.uPar, S.par); gl.uniform2fv(u.uCenter, S.center);
      gl.uniform3fv(u.uC1, S.c1); if (u.uC2) gl.uniform3fv(u.uC2, S.c2); gl.uniform3fv(u.uC3, S.c3);
      return u;
    };
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, tw, th);
    set(neb, [W, H]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    const u = set(out, [W, H]);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(u.tNeb, 0);
    gl.uniform2fv(u.uMouse, S.mouse); gl.uniform1f(u.uWarp, S.warp); gl.uniform1f(u.uTravel, S.travel); gl.uniform1f(u.uFlash, S.flash); gl.uniform1f(u.uHex, S.hex);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // draw only while on screen; with reduced motion, only redraw when something changes
  let visible = false, raf = 0, last = performance.now();
  const tick = now => {
    raf = 0;
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    frame(dt, now / 1000);
    if (!still || wt >= 0 || Math.abs(hexT - S.hex) > .01) kick();
  };
  function kick() { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(tick); }
  new IntersectionObserver(es => { visible = es[0].isIntersecting; kick(); }).observe(box);
  document.addEventListener('visibilitychange', kick);
  new ResizeObserver(size).observe(box);
  size();
}
})();
