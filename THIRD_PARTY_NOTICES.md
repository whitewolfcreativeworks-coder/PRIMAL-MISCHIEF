# Dependency and asset attribution register

Primal Mischief's own code, card text, rules, procedural artwork and
synthesized sounds are original to this project.

## Shipped to players (runtime)

| Package | Licence | Use |
|---|---|---|
| react, react-dom, scheduler | MIT | Client UI |
| @fontsource/marcellus (Marcellus by Astigmatic) | SIL OFL 1.1 | Display typeface, self-hosted |
| @fontsource-variable/inter (Inter by Rasmus Andersson) | SIL OFL 1.1 | UI typeface, self-hosted |
| three (three.js) 0.186.1 | MIT | Hologram battle theater (WebGL) |
| ws | MIT | Server WebSockets |

OFL fonts may be bundled and used commercially; they may not be sold on
their own. The licence texts ship in `node_modules/@fontsource*/LICENSE`
and must accompany redistributed font files.

## Build and test only (not shipped)

| Package | Licence |
|---|---|
| vite, @vitejs/plugin-react, rolldown | MIT |
| lightningcss (Vite CSS dependency) | **MPL-2.0** — build tool only; file-level copyleft applies only if *its* source is modified and distributed. No action needed for normal use. |
| typescript | Apache-2.0 |
| vitest, tsx, esbuild | MIT |
| @types/* (incl. @types/three) | MIT |

Audit performed with a scan of every installed package's declared licence
(Nov 2026): no GPL or AGPL dependencies.

## Assets

| Asset | Source | Licence |
|---|---|---|
| Card illustrations and civilization emblems | Procedural SVG in `apps/client/src/art/motifs.tsx`, written for this project | Project-owned |
| Hologram miniatures and shaders | Procedural Three.js geometry and GLSL in `apps/client/src/holo/`, written for this project | Project-owned |
| Icons | `apps/client/src/ui/icons.tsx`, written for this project | Project-owned |
| Sound effects | Synthesized at runtime with the Web Audio API (`audio.ts`) | Project-owned (no samples) |
| Music | None | — |

No images, sounds or names from commercial card games are used. Card
mechanics such as blocking and "reactions" are common, non-proprietary game
concepts; no rules text was copied.

## Process for adding assets

Record every new dependency or asset here with its source URL, licence and
whether it ships. Avoid: GPL/AGPL code in the client or server, CC-BY-NC or
other non-commercial licences, unlicensed web images, AI-generated assets
whose model terms restrict commercial use.
