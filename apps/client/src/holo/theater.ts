import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { HoloModel } from './kit';

/*
 * The hologram theater: a small projected stage that acts out what just
 * happened on the table. It renders only while a scene is playing, so it
 * costs nothing between moves.
 */

export const MY_COLOR = 0x6ef2ff;
export const OPP_COLOR = 0xffae6a;

export interface Vignette {
  duration: number; // seconds at pace 1
  caption: string;
  tone?: 'mine' | 'theirs' | 'reverse' | 'age' | 'neutral';
  setup(stage: Stage): void;
  update(stage: Stage, t: number): void;
}

/** Eased progress of `t` through the window [a, b]. */
export function seg(t: number, a: number, b: number, ease = true): number {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return ease ? x * x * (3 - 2 * x) : x;
}

interface Particles {
  points: THREE.Points;
  vel: Float32Array;
  life: Float32Array;
  gravity: number;
  age: number;
  ttl: number;
}

export class Stage {
  scene = new THREE.Scene();
  root = new THREE.Group();
  time = 0;
  private models: HoloModel[] = [];
  private particles: Particles[] = [];
  private sprites: { sprite: THREE.Sprite; born: number; ttl: number; tex: THREE.Texture }[] = [];
  constructor() {
    this.scene.add(this.root);
    this.buildProjector();
  }

  private projector: THREE.Object3D[] = [];
  private buildProjector() {
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.1, 64), new THREE.MeshBasicMaterial({ color: 0x8ff6ff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.05, 64), new THREE.MeshBasicMaterial({ color: 0x2bb6d1, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2;
    const grid = new THREE.PolarGridHelper(1.05, 12, 5, 64, 0x3fd8ef, 0x1f7f90);
    (grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = 0.22;
    (grid.material as THREE.Material).blending = THREE.AdditiveBlending;
    // A soft cone of light rising from the emitter.
    const beamMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: 'varying float vY; void main(){ vY = position.y; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform float uTime; varying float vY; void main(){ float a = (1.0 - smoothstep(-0.6, 0.6, vY)) * 0.045 * (0.85 + 0.15*sin(uTime*3.0 + vY*20.0)); gl_FragColor = vec4(0.45, 0.95, 1.0, a); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.9, 1.2, 48, 1, true), beamMat);
    beam.position.y = 0.6;
    for (const o of [disc, grid, ring, beam]) { this.scene.add(o); this.projector.push(o); }
    this.beamMat = beamMat;
  }
  private beamMat!: THREE.ShaderMaterial;

  /** Track a model built elsewhere (figures, vehicles, architecture) so it animates, fades and is disposed with the scene. Adds it to the stage unless it already has a parent. */
  register(m: HoloModel, pos?: [number, number, number], scale?: number) {
    if (!m.group.parent) this.root.add(m.group);
    if (pos) m.group.position.set(...pos);
    if (scale) m.group.scale.setScalar(scale);
    m.uniforms.uReveal.value = -1;
    this.models.push(m);
    return m;
  }

  /** Camera framing for the current moment (set by scenes; smoothed by the theater). */
  shot = { focusX: 0, focusZ: 0, zoom: 1, height: 1 };
  /** Frame the action: look at scene point (x, z), zoom > 1 moves closer. */
  frame(x: number, z = 0, zoom = 1, height = 1) { this.shot.focusX = x; this.shot.focusZ = z; this.shot.zoom = zoom; this.shot.height = height; }

  /** Sweep a model into existence from the floor up (p: 0..1). */
  reveal(m: HoloModel, p: number) {
    m.uniforms.uReveal.value = p >= 1 ? 99 : m.group.position.y - 0.02 + (m.height * m.group.scale.y + 0.05) * p;
  }

  /** Dissolve: fade, glitch and sink. */
  dissolve(m: HoloModel, p: number) {
    m.uniforms.uOpacity.value = 1 - p;
    m.uniforms.uGlitch.value = p > 0 && p < 1 ? 1 : 0;
  }

  /** Break a model into its parts and let them fall (p: 0..1). */
  shatter(m: HoloModel, p: number) {
    const ud = m.group.userData as { shards?: { v: THREE.Vector3; r: THREE.Vector3; base: THREE.Vector3; rot: THREE.Euler }[] };
    if (!ud.shards) {
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;
      ud.shards = m.parts.map((part) => ({
        v: new THREE.Vector3(rnd() * 1.4, 0.4 + rnd() * 0.5, rnd() * 1.2),
        r: new THREE.Vector3(rnd() * 6, rnd() * 6, rnd() * 6),
        base: part.position.clone(), rot: part.rotation.clone(),
      }));
    }
    m.parts.forEach((part, i) => {
      const s = ud.shards![i];
      const tt = p * 1.1;
      part.position.set(s.base.x + s.v.x * tt, Math.max(-0.05, s.base.y + s.v.y * tt - 1.6 * tt * tt), s.base.z + s.v.z * tt);
      part.rotation.set(s.rot.x + s.r.x * tt, s.rot.y + s.r.y * tt, s.rot.z + s.r.z * tt);
    });
    m.uniforms.uHeat.value = Math.min(1, p * 3);
    m.uniforms.uOpacity.value = 1 - seg(p, 0.5, 1);
    m.uniforms.uGlitch.value = p > 0 && p < 1 ? 0.6 : 0;
  }

  burst(pos: THREE.Vector3 | [number, number, number], color: number, n = 60, opts: { speed?: number; gravity?: number; ttl?: number; size?: number; up?: number } = {}) {
    const p = pos instanceof THREE.Vector3 ? pos : new THREE.Vector3(...pos);
    const geo = new THREE.BufferGeometry();
    const arr = new Float32Array(n * 3), vel = new Float32Array(n * 3), life = new Float32Array(n);
    const speed = opts.speed ?? 1;
    for (let i = 0; i < n; i++) {
      arr.set([p.x, p.y, p.z], i * 3);
      const th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI;
      vel.set([Math.cos(th) * Math.sin(ph) * speed, (Math.abs(Math.cos(ph)) + (opts.up ?? 0)) * speed, Math.sin(th) * Math.sin(ph) * speed], i * 3);
      life[i] = 0.5 + Math.random() * 0.5;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const mat = new THREE.PointsMaterial({ color, size: opts.size ?? 0.03, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
    const points = new THREE.Points(geo, mat);
    this.root.add(points);
    this.particles.push({ points, vel, life, gravity: opts.gravity ?? 1.2, age: 0, ttl: opts.ttl ?? 0.9 });
  }

  private fired = new Set<string>();
  /** Run a one-off effect once per scene. */
  once(key: string, fn: () => void) { if (!this.fired.has(key)) { this.fired.add(key); fn(); } }

  /** A floating text label (damage numbers, outcomes). */
  label(text: string, pos: [number, number, number], color = '#ffffff', ttl = 1.2, size = 0.32) {
    if (typeof document === 'undefined') return; // headless (tests)
    const c = document.createElement('canvas');
    c.width = 512; c.height = 128;
    const g = c.getContext('2d')!;
    g.font = '600 76px Marcellus, Georgia, serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 24;
    g.fillStyle = color;
    g.fillText(text, 256, 64);
    const tex = new THREE.CanvasTexture(c);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sprite.scale.set(size * 4, size, 1);
    sprite.position.set(...pos);
    this.root.add(sprite);
    this.sprites.push({ sprite, born: this.time, ttl, tex });
  }

  tick(dt: number) {
    this.time += dt;
    this.beamMat.uniforms.uTime.value = this.time;
    if (this.riverMat) this.riverMat.uniforms.uTime.value = this.time;
    for (const m of this.models) m.uniforms.uTime.value = this.time;
    for (const ps of this.particles) {
      ps.age += dt;
      const pos = ps.points.geometry.getAttribute('position') as THREE.BufferAttribute;
      const a = pos.array as Float32Array;
      for (let i = 0; i < ps.life.length; i++) {
        ps.vel[i * 3 + 1] -= ps.gravity * dt;
        a[i * 3] += ps.vel[i * 3] * dt; a[i * 3 + 1] += ps.vel[i * 3 + 1] * dt; a[i * 3 + 2] += ps.vel[i * 3 + 2] * dt;
      }
      pos.needsUpdate = true;
      (ps.points.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - ps.age / ps.ttl);
    }
    this.particles = this.particles.filter((ps) => {
      if (ps.age < ps.ttl) return true;
      this.root.remove(ps.points); ps.points.geometry.dispose(); (ps.points.material as THREE.Material).dispose();
      return false;
    });
    this.sprites = this.sprites.filter((s) => {
      const k = (this.time - s.born) / s.ttl;
      s.sprite.position.y += dt * 0.25;
      (s.sprite.material as THREE.SpriteMaterial).opacity = k < 0.15 ? k / 0.15 : 1 - seg(k, 0.6, 1);
      if (k < 1) return true;
      this.root.remove(s.sprite); s.tex.dispose(); s.sprite.material.dispose();
      return false;
    });
  }

  /** Fade the whole projection (start/end of a scene). */
  fadeAll(p: number) {
    for (const m of this.models) m.uniforms.uOpacity.value = Math.min(m.uniforms.uOpacity.value, 1 - p);
  }

  /** Rotation of the scene: +π/2 = action flows away from the viewer (you attack), −π/2 = toward the viewer. */
  facing = 0;

  /** A hologram river running across the stage at scene-x = center (width w). */
  river(center = -0.25, w = 0.42) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform float uTime; varying vec2 vUv;
        void main(){
          float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
          float flow = 0.5 + 0.5*sin(vUv.y*46.0 - uTime*3.0 + sin(vUv.x*9.0 + uTime)*1.6);
          float lines = smoothstep(0.86, 1.0, flow);
          float fade = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
          gl_FragColor = vec4(vec3(0.35, 0.85, 1.0) * (0.35 + lines*1.4), (0.10 + lines*0.45) * edge * fade);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(w, 2.0, 1, 1), mat);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(center, 0.005, 0);
    this.root.add(strip);
    this.riverMat = mat;
  }
  private riverMat: THREE.ShaderMaterial | null = null;

  clear() {
    this.riverMat = null;
    this.fired.clear();
    for (const m of this.models) { this.root.remove(m.group); m.dispose(); }
    this.models = [];
    for (const ps of this.particles) { this.root.remove(ps.points); ps.points.geometry.dispose(); (ps.points.material as THREE.Material).dispose(); }
    this.particles = [];
    for (const s of this.sprites) { this.root.remove(s.sprite); s.tex.dispose(); s.sprite.material.dispose(); }
    this.sprites = [];
    // Anything else a scene added directly (orbs, shields, waves).
    this.root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry?.dispose(); (m.material as THREE.Material)?.dispose?.(); } });
    this.root.clear();
    this.root.rotation.set(0, 0, 0);
    this.facing = 0;
    this.shot = { focusX: 0, focusZ: 0, zoom: 1, height: 1 };
  }
}

export class Theater {
  private renderer: THREE.WebGLRenderer;
  private camera = new THREE.PerspectiveCamera(34, 1, 0.05, 20);
  private stage = new Stage();
  private queue: Vignette[] = [];
  private current: Vignette | null = null;
  private t = 0;
  private last = 0;
  private raf = 0;
  private started = 0;
  speed = 1;
  /** When set, this scene replays whenever the queue runs dry (card close-ups). */
  loop: (() => Vignette) | null = null;
  onChange: (v: Vignette | null) => void = () => {};

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    // The canvas is composited with mix-blend-mode: screen, so black is see-through and the bloom glows over the table.
    this.renderer.setClearColor(0x000000, 1);
    this.camera.position.set(0, 1.3, 3.15);
    this.camera.lookAt(0, 0.2, 0);
    try {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.stage.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.38, 0.3, 0.85);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    } catch (e) { console.warn('bloom unavailable', e); this.composer = null; }
  }
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;

  /** Render a single frame of a scene at time t (for stills and visual checks). */
  still(v: Vignette, at: number) {
    cancelAnimationFrame(this.raf); this.raf = 0;
    this.queue = []; this.current = null;
    this.stage.clear();
    this.cam = { x: 0, z: 0, zoom: 1, height: 1 };
    v.setup(this.stage);
    this.resize();
    const dt = 1 / 30;
    for (let t = 0; t <= at; t += dt) {
      this.stage.root.rotation.y = this.stage.facing + Math.sin(this.stage.time * 0.35) * 0.12;
      v.update(this.stage, Math.min(t, v.duration));
      this.aim(dt);
      this.stage.tick(dt);
    }
    if (this.composer) this.composer.render(dt); else this.renderer.render(this.stage.scene, this.camera);
  }

  /** Glow strength (0 turns the bloom pass off). */
  setBloom(strength: number) { if (this.bloom) { this.bloom.strength = strength; this.bloom.enabled = strength > 0; } }

  get busy() { return !!this.current || this.queue.length > 0; }

  enqueue(v: Vignette) {
    // Keep up with the game: never let more than three scenes back up.
    if (this.queue.length >= 6) this.queue.shift();
    this.queue.push(v);
    if (!this.current) this.next();
  }

  skip() { this.finish(); }
  skipAll() { this.queue = []; this.finish(); }

  private finish() {
    if (!this.current) return;
    this.current = null;
    this.stage.clear();
    this.next();
  }

  private next() {
    if (!this.queue.length && this.loop) this.queue.push(this.loop());
    const v = this.queue.shift() ?? null;
    this.current = v;
    this.onChange(v);
    if (!v) { cancelAnimationFrame(this.raf); this.raf = 0; this.renderer.clear(); return; }
    this.t = 0;
    this.stage.clear();
    this.cam = { x: 0, z: 0, zoom: 1, height: 1 };
    try { v.setup(this.stage); } catch (e) { console.error('hologram scene failed to start', e); this.current = null; this.stage.clear(); this.next(); return; }
    this.last = performance.now();
    this.started = this.last;
    if (!this.raf) this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number) => {
    this.raf = 0;
    const v = this.current;
    if (!v) return;
    // Follow the real clock (with a generous cap) so slow GPUs drop frames instead of slowing the game.
    const dt = Math.min(0.25, Math.max(0, (now - this.last) / 1000)) * this.speed;
    this.last = now;
    this.t += dt;
    this.resize();
    this.stage.root.rotation.y = this.stage.facing + Math.sin(this.stage.time * 0.35) * 0.12; // scene facing + gentle orbit
    try {
      v.update(this.stage, Math.min(this.t, v.duration));
      this.aim(dt);
      this.stage.tick(dt);
      if (this.composer) this.composer.render(dt); else this.renderer.render(this.stage.scene, this.camera);
    } catch (e) {
      // A broken scene must never freeze the game: log it and move on.
      console.error('hologram scene failed', e);
      this.finish();
      return;
    }
    if (this.t >= v.duration || now - this.started > (v.duration / this.speed) * 1000 + 1500) { this.finish(); return; }
    this.raf = requestAnimationFrame(this.frame);
  };

  private cam = { x: 0, z: 0, zoom: 1, height: 1 };
  /** Ease the camera toward the scene's requested shot. */
  private aim(dt: number) {
    const sh = this.stage.shot, c = this.cam, k = 1 - Math.exp(-dt * 2.2);
    c.x += (sh.focusX - c.x) * k; c.z += (sh.focusZ - c.z) * k; c.zoom += (sh.zoom - c.zoom) * k; c.height += (sh.height - c.height) * k;
    this.stage.root.updateMatrixWorld();
    const focus = new THREE.Vector3(c.x, 0.18, c.z).applyMatrix4(this.stage.root.matrixWorld);
    const a = this.camera.aspect, tall = a < 1.2 ? 1.05 : a > 1.75 ? 1.02 : 0.9; // wide strips need more room top-to-bottom
    this.camera.position.set(focus.x * 0.6, focus.y + (1.3 * c.height * tall) / c.zoom, focus.z * 0.6 + (2.6 * tall) / c.zoom);
    this.camera.lookAt(focus.x, focus.y + 0.02, focus.z);
  }

  private resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    const c = this.renderer.domElement;
    if (c.width !== Math.floor(w * this.renderer.getPixelRatio()) || c.height !== Math.floor(h * this.renderer.getPixelRatio())) {
      this.renderer.setSize(w, h, false);
      this.composer?.setPixelRatio(this.renderer.getPixelRatio());
      this.composer?.setSize(w, h);
      this.camera.aspect = w / h;
      // Keep the whole stage in view on tall screens.
      this.camera.fov = w / h < 1.2 ? 48 : 34;
      this.camera.updateProjectionMatrix();
    }
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.stage.clear();
    this.composer?.dispose();
    this.renderer.dispose();
  }
}
