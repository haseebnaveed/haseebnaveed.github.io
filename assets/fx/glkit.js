// Shared bits for the hero shaders: compiling, the palette's colours, the pointer, a few matrix helpers,
// and a loop that only runs while the hero is on screen. Plain WebGL2, no three.js.
// A plain script (not a module), so it also runs when the page is opened straight from disk.
(() => {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;

  // palette hex to linear rgb
  const lin = hex => {
    const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
    const n = m ? parseInt(m[1], 16) : 0xffffff;
    return [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
  };

  // linear back to the screen's colour space, for clearColor
  const out = c => c.map(v => v <= .0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - .055);

  function prog(gl, vs, fs) {
    const p = gl.createProgram();
    [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]].forEach(([t, src]) => {
      const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    });
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < n; i++) {
      const a = gl.getActiveUniform(p, i); u[a.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, a.name);
    }
    return { p, u };
  }

  // the page's colours, eased so a palette change glides in instead of jumping
  function colours() {
    const S = { bg: [0, 0, 0], c: [[1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1]], light: 0, flat: new Float32Array(12) };
    let first = true;
    S.update = k => {
      const v = window.gfx ? window.gfx.v : {};
      const e = first ? 1 : k; first = false;
      const ease = (a, b) => { for (let i = 0; i < 3; i++) a[i] += (b[i] - a[i]) * e; };
      ease(S.bg, lin(v['hero-bg'] || v.bg || '#000000'));
      for (let i = 0; i < 4; i++) { ease(S.c[i], lin(v['c' + (i + 1)])); S.flat.set(S.c[i], i * 3); }
      S.light += ((root.classList.contains('light') ? 1 : 0) - S.light) * e;
    };
    S.update(1);
    return S;
  }

  // the pointer anywhere over the hero, in 0..1 across the art box (y down), plus clicks that aren't on a link or button
  function pointer(box, onClick) {
    const hero = box.closest('.hero') || box;
    const P = { x: .75, y: .5, in: false, kick: null };
    hero.addEventListener('pointermove', e => {
      const r = box.getBoundingClientRect();
      P.x = (e.clientX - r.left) / r.width; P.y = (e.clientY - r.top) / r.height; P.in = e.pointerType !== 'touch';
      if (P.kick) P.kick();
    });
    hero.addEventListener('pointerleave', () => { P.in = false; });
    hero.addEventListener('click', e => {
      if (e.target.closest('a,button,input') || String(getSelection()).trim()) return;
      const r = box.getBoundingClientRect();
      onClick((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
      if (P.kick) P.kick();
    });
    return P;
  }

  // run frame(dt, t) while on screen; with reduced motion, only while frame() says something is still moving
  function run(box, frame) {
    let visible = false, raf = 0, last = performance.now();
    const tick = now => {
      raf = 0;
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      if (frame(dt, now / 1000) || !still) kick();
    };
    function kick() { if (!raf && visible && !document.hidden) { last = performance.now() - 16; raf = requestAnimationFrame(tick); } }
    new IntersectionObserver(es => { visible = es[0].isIntersecting; kick(); }).observe(box);
    document.addEventListener('visibilitychange', kick);
    return kick;
  }

  // column-major 4x4 matrices, just what the heroes need
  const M = {
    mul(a, b) {
      const o = new Float32Array(16);
      for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
        let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s;
      }
      return o;
    },
    persp(fov, asp, n, f) {
      const t = 1 / Math.tan(fov / 2), o = new Float32Array(16);
      o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f);
      return o;
    },
    ortho(l, r, b, t, n, f) {
      const o = new Float32Array(16);
      o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = -2 / (f - n);
      o[12] = -(r + l) / (r - l); o[13] = -(t + b) / (t - b); o[14] = -(f + n) / (f - n); o[15] = 1;
      return o;
    },
    look(e, c, up) {
      const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
      const nrm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
      const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const z = nrm(sub(e, c)), x = nrm(cross(up, z)), y = cross(z, x);
      return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1]);
    },
  };

  // shared shader pieces
  const GLSL = {
    noise: `
      float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
        return mix(mix(h21(i), h21(i + vec2(1., 0.)), f.x), mix(h21(i + vec2(0., 1.)), h21(i + vec2(1., 1.)), f.x), f.y); }`,
    srgb: `vec3 srgb(vec3 c){ c = clamp(c, 0., 1.); return mix(pow(c, vec3(.41666)) * 1.055 - .055, c * 12.92, vec3(lessThanEqual(c, vec3(.0031308)))); }`,
    tri: `#version 300 es
      layout(location = 0) in vec2 p; out vec2 vUv; void main(){ vUv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`,
  };

  // a full-screen triangle on attribute 0
  function tri(gl) {
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return vao;
  }

  window.hnGL = { still, lin, out, prog, colours, pointer, run, M, GLSL, tri };
})();
