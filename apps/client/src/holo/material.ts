import * as THREE from 'three';

/*
 * Hologram look: additive, translucent surfaces with a fresnel rim, drifting
 * scanlines, a soft flicker and a bottom-up "materialize" sweep. Every model
 * in the theater uses one of these materials plus glowing edge lines.
 */

export interface HoloUniforms {
  uColor: { value: THREE.Color };
  uTime: { value: number };
  uOpacity: { value: number };
  uReveal: { value: number }; // world-space height below which the model is visible
  uGlitch: { value: number }; // 0..1 horizontal jitter
  uHeat: { value: number }; // 0..1 tint toward red-white (damage / fire)
}

const vert = /* glsl */ `
  uniform float uTime;
  uniform float uGlitch;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    float band = step(0.82, fract(sin(floor(world.y * 18.0 + uTime * 9.0) * 43758.5) * 0.5 + 0.5));
    world.x += band * uGlitch * 0.08 * sin(uTime * 70.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const frag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uReveal;
  uniform float uHeat;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    if (vWorld.y > uReveal) discard;
    float fres = pow(1.0 - abs(dot(normalize(vNormal), vView)), 2.2);
    float scan = 0.55 + 0.45 * sin(vWorld.y * 140.0 - uTime * 6.0);
    float flicker = 0.88 + 0.12 * sin(uTime * 37.0 + vWorld.x * 3.0) * sin(uTime * 13.0);
    float edge = smoothstep(uReveal - 0.05, uReveal, vWorld.y); // bright leading edge of the sweep
    vec3 col = mix(uColor, vec3(1.0, 0.55, 0.35), uHeat);
    float a = (0.16 + fres * 0.85) * scan * flicker + edge * 0.9;
    gl_FragColor = vec4(col * (0.7 + fres + edge * 1.5), a * uOpacity);
  }
`;

export function holoMaterial(color: THREE.ColorRepresentation): THREE.ShaderMaterial & { uniforms: HoloUniforms } {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uReveal: { value: 99 },
      uGlitch: { value: 0 },
      uHeat: { value: 0 },
    },
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  }) as THREE.ShaderMaterial & { uniforms: HoloUniforms };
}

const lineVert = /* glsl */ `
  varying float vY;
  void main() { vec4 w = modelMatrix * vec4(position, 1.0); vY = w.y; gl_Position = projectionMatrix * viewMatrix * w; }
`;
const lineFrag = /* glsl */ `
  uniform vec3 uColor; uniform float uOpacity; uniform float uReveal; uniform float uHeat; uniform float uTime;
  varying float vY;
  void main() {
    if (vY > uReveal) discard;
    vec3 col = mix(uColor, vec3(1.0, 0.6, 0.4), uHeat);
    float f = 0.85 + 0.15 * sin(uTime * 29.0);
    gl_FragColor = vec4(col * 1.6, 0.85 * uOpacity * f);
  }
`;

export function holoLineMaterial(shared: HoloUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: shared as unknown as Record<string, THREE.IUniform>,
    vertexShader: lineVert,
    fragmentShader: lineFrag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
