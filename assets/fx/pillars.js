// Hero: a field of blocks seen from above at an angle, rising and settling like a slow swell.
// Blocks lift and take on colour under the pointer; click to send a wave through the field, which brings in a new palette.
// A few thousand instanced boxes on plain WebGL2, heights worked out on the GPU.
// A plain script (not a module), so it also runs when the page is opened straight from disk. Needs glkit.js first.
(() => {
const K = window.hnGL;

const VS = `#version 300 es
precision highp float;
layout(location = 0) in vec3 pos;
layout(location = 1) in vec3 nrm;
layout(location = 2) in vec2 cell;
uniform mat4 uVP; uniform vec2 uN, uMouse; uniform float uTime, uMouseOn, uGap;
uniform vec4 uWave;   // centre, radius, strength
uniform vec3 uC[4]; uniform vec3 uBg; uniform float uLight;
${K.GLSL.noise}
out vec3 vN; out vec3 vLocal; out vec3 vCol; out float vY, vLift;
void main(){
  vec2 w = cell - uN * .5 + .5;
  float n = noise(w * .085 + vec2(uTime * .045, uTime * .028)) * .65 + noise(w * .21 - uTime * .03) * .35;
  float h = .2 + pow(n, 1.7) * 2.2;
  vec2 dm = w - uMouse;
  float lift = uMouseOn * exp(-dot(dm, dm) / 7.);
  float rd = (length(w - uWave.xy) - uWave.z) / 1.3;
  float ring = uWave.w * exp(-rd * rd);
  h += lift * 2.2 + ring * 2.2;
  // each patch of the field leans to one of the four accents
  float pick = noise(w * .06 + 17.3) * 3.999;
  vec3 c = pick < 1. ? uC[0] : pick < 2. ? uC[1] : pick < 3. ? uC[2] : uC[3];
  vCol = c;
  vLift = clamp(smoothstep(1.1, 2.6, h) * .28 + lift * .7 + ring * .6, 0., 1.);
  vec3 p = vec3(w.x + pos.x * uGap, pos.y * h, w.y + pos.z * uGap);
  vN = nrm; vLocal = pos; vY = p.y;
  gl_Position = uVP * vec4(p, 1.);
}`;

const FS = `#version 300 es
precision highp float;
in vec3 vN; in vec3 vLocal; in vec3 vCol; in float vY, vLift; out vec4 o;
uniform vec3 uBg; uniform float uLight, uFade; uniform vec2 uRes;
${K.GLSL.srgb}
void main(){
  vec3 L = normalize(vec3(-.35, 1., .5));
  float lam = mix(.5, .72, uLight) + mix(.5, .28, uLight) * max(dot(vN, L), 0.);
  vec3 base = mix(uBg + vec3(.025), uBg * .93, uLight);
  float ao = mix(mix(.35, .75, uLight), 1., smoothstep(0., 2.2, vY));
  vec3 col = mix(base, vCol, vLift * .8) * lam * mix(ao, 1., step(.5, vN.y));
  // a fine edge round each top, so the field reads as blocks
  if (vN.y > .5){
    vec2 q = abs(vLocal.xz);
    float e = max(q.x, q.y), fw = fwidth(e);
    float edge = smoothstep(.5 - fw * 1.5, .5, e);
    col = mix(col, mix(vec3(.9), vCol, .55 + .45 * vLift) * mix(1., .55, uLight), edge * (.1 + .5 * vLift));
  }
  float sx = gl_FragCoord.x / uRes.x;
  col = mix(uBg, col, mix(1., .06 + .94 * smoothstep(.1, .7, sx), uFade));
  o = vec4(srgb(col), 1.);
}`;

// a unit box standing on the ground: x and z from -.5 to .5, y from 0 to 1, with face normals
function cube() {
  const F = [
    [[0, 1, 0], [[-.5, 1, -.5], [-.5, 1, .5], [.5, 1, .5], [.5, 1, -.5]]],
    [[1, 0, 0], [[.5, 0, -.5], [.5, 1, -.5], [.5, 1, .5], [.5, 0, .5]]],
    [[-1, 0, 0], [[-.5, 0, .5], [-.5, 1, .5], [-.5, 1, -.5], [-.5, 0, -.5]]],
    [[0, 0, 1], [[.5, 0, .5], [.5, 1, .5], [-.5, 1, .5], [-.5, 0, .5]]],
    [[0, 0, -1], [[-.5, 0, -.5], [-.5, 1, -.5], [.5, 1, -.5], [.5, 0, -.5]]],
  ];
  const out = [];
  F.forEach(([n, q]) => [0, 1, 2, 0, 2, 3].forEach(i => out.push(...q[i], ...n)));
  return new Float32Array(out);
}

window.hnPillars = function pillars(box) {
  const canvas = box.querySelector('canvas');
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'low-power' });
  if (!gl) { box.classList.add('no-gl'); return; }
  let pg;
  try { pg = K.prog(gl, VS, FS); } catch (e) { console.error(e); box.classList.add('no-gl'); return; }
  const C = K.colours();

  const geo = cube();
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, geo, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
  const cells = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cells);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(2, 1);
  gl.bindVertexArray(null);

  let W = 1, H = 1, narrow = false, N = 0, view = 20;
  function size() {
    const pr = Math.min(devicePixelRatio || 1, 1.5);
    W = Math.max(1, Math.round(box.clientWidth * pr)); H = Math.max(1, Math.round(box.clientHeight * pr));
    canvas.width = W; canvas.height = H; narrow = box.clientWidth < 700;
    view = narrow ? 15 : 21;
    // enough cells to cover the screen once it's turned 45 degrees
    const n = Math.ceil(Math.hypot(view * W / H, view) * 1.25);
    if (n !== N) {
      N = n;
      const a = new Float32Array(N * N * 2);
      for (let j = 0, k = 0; j < N; j++) for (let i = 0; i < N; i++) { a[k++] = i; a[k++] = j; }
      gl.bindBuffer(gl.ARRAY_BUFFER, cells); gl.bufferData(gl.ARRAY_BUFFER, a, gl.STATIC_DRAW);
    }
    if (kick) kick();
  }

  // camera: looking down at the field from one corner
  const dir = [1, 1.2, 1], eye = dir.map(v => v * 40);
  const V = K.M.look(eye, [0, 0, 0], [0, 1, 0]);
  const right = [V[0], V[4], V[8]], up = [V[1], V[5], V[9]], fwd = [-V[2], -V[6], -V[10]];
  // where a point on screen lands on the field, a block's height above the ground
  function ground(x, y) {
    const hw = view * W / H / 2, hh = view / 2;
    const ox = (x * 2 - 1) * hw, oy = (1 - y * 2) * hh;
    const o = [0, 1, 2].map(i => eye[i] + right[i] * ox + up[i] * oy);
    const t = (1.2 - o[1]) / fwd[1];
    return [o[0] + fwd[0] * t, o[2] + fwd[2] * t];
  }

  let wave = null, mouse = [0, 0], on = 0, time = Math.random() * 100;
  const P = K.pointer(box, (x, y) => {
    wave = { c: ground(x, y), r: 0, s: 1, shuffled: false };
  });

  function frame(dt) {
    if (!K.still) time += dt;
    C.update(1 - Math.exp(-dt * 3));
    const m = ground(P.x, P.y);
    mouse[0] += (m[0] - mouse[0]) * Math.min(1, dt * 8); mouse[1] += (m[1] - mouse[1]) * Math.min(1, dt * 8);
    on += ((P.in ? 1 : 0) - on) * Math.min(1, dt * 3);
    let w = [0, 0, 0, 0];
    if (wave) {
      wave.r += dt * 16; wave.s = Math.max(0, 1 - wave.r / 40);
      if (!wave.shuffled && wave.r > 3) { wave.shuffled = true; if (window.gfx) window.gfx.shuffleNow(); }
      w = [wave.c[0], wave.c[1], wave.r, wave.s];
      if (wave.s <= 0) wave = null;
    }
    const hw = view * W / H / 2, hh = view / 2;
    const vp = K.M.mul(K.M.ortho(-hw, hw, -hh, hh, 1, 140), V);

    gl.viewport(0, 0, W, H);
    gl.clearColor(...K.out(C.bg), 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);
    gl.useProgram(pg.p);
    const u = pg.u;
    gl.uniformMatrix4fv(u.uVP, false, vp);
    gl.uniform2f(u.uN, N, N); gl.uniform2fv(u.uMouse, mouse); gl.uniform1f(u.uMouseOn, on);
    gl.uniform1f(u.uTime, time); gl.uniform1f(u.uGap, .86); gl.uniform4fv(u.uWave, w);
    gl.uniform3fv(u.uC, C.flat); gl.uniform3fv(u.uBg, C.bg); gl.uniform1f(u.uLight, C.light);
    gl.uniform1f(u.uFade, narrow ? 0 : 1); gl.uniform2f(u.uRes, W, H);
    gl.bindVertexArray(vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 30, N * N);
    return !!wave || Math.abs((P.in ? 1 : 0) - on) > .01;
  }

  var kick = K.run(box, frame);
  P.kick = kick;
  new ResizeObserver(size).observe(box);
  size();
};
})();
