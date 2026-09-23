# Third-party 3D assets

Used in `frontend/src/components/SiteScene.jsx` (the Docked Mode 3D scene) and
shipped under `frontend/public/models/`. Everything else in the scene (the
excavator itself, ground, trench, spoil pile, fibre line, power poles/wires,
site office) is original procedural geometry with no third-party asset risk.

## Dump truck

- **File:** `frontend/public/models/dumptruck.glb`
- **Source:** "Dump truck" by jeremy, via [poly.pizza](https://poly.pizza/m/1BpGYg14QGD)
  (originally hosted on Google Poly before its shutdown; poly.pizza mirrors it
  with the original license intact)
- **License:** CC BY 3.0 ([creativecommons.org/licenses/by/3.0](https://creativecommons.org/licenses/by/3.0/))
- **Attribution:** "Dump truck" by jeremy, licensed under CC BY 3.0
- **Used for:** the dumper truck ("Dumper T-07") that drives in/out of the
  loading bay. Only material `roughness`/`metalness` were tuned in code
  (`prepMaterials` in `SiteScene.jsx`); geometry and UVs are unmodified.
- **Size:** ~126 KB

## Worker figures

- **Files:** `frontend/public/models/worker-d.glb`, `frontend/public/models/worker-e.glb`,
  plus their referenced textures `frontend/public/models/Textures/texture-d.png`
  and `texture-e.png`
- **Source:** "Blocky Characters" pack by Kenney, [kenney.nl/assets/blocky-characters](https://kenney.nl/assets/blocky-characters)
- **License:** CC0 1.0 Universal ([creativecommons.org/publicdomain/zero/1.0](https://creativecommons.org/publicdomain/zero/1.0/))
  — public domain, no attribution required (credited here anyway as good practice)
- **Used for:** the two worker figures on site ("Day 3 · Suresh" and
  "Spotter · Anbu"). Two different character skins (`character-d.glb` /
  `character-e.glb` from the pack, renamed) were picked from the 18 included
  for visual variety; the pack's built-in `idle` animation clip is played via
  `useAnimations`. No geometry modification.
- **Size:** ~114 KB each (~228 KB total)

## Machine photos (`frontend/public/machines/`)

Product-style thumbnails for each machine type. Sourced from Wikimedia Commons; **modified**:
background removed (rembg, isnet-general-use), cropped, resized to 640×480 and saved as WebP.
The modified files are shared under the same licence as each original.

| File | Original | Author | Licence |
|---|---|---|---|
| `excavator.webp` | [Excavator side.jpg](https://commons.wikimedia.org/wiki/File:Excavator_side.jpg) (Cat 320) | Wikideas1 | CC0 1.0 |
| `wheel-loader.webp` | [Caterpillar 950k Wheel Loader.jpg](https://commons.wikimedia.org/wiki/File:Caterpillar_950k_Wheel_Loader.jpg) | Matthew T Rader | CC BY-SA 4.0 |
| `dumper.webp` | [CAT 730.jpg](https://commons.wikimedia.org/wiki/File:CAT_730.jpg) | Norbert Schnitzler | CC BY-SA 3.0 |
| `backhoe.webp` | [JCB 3CX backhoe loader.jpg](https://commons.wikimedia.org/wiki/File:JCB_3CX_backhoe_loader.jpg) | Andrey Butko | CC BY-SA 3.0 |

The photos show sibling models of the fleet data (950K for the 950 GC, 730 for the 725, 3CX
for the 3DX); alt text names the machine type rather than the exact model. Caterpillar and
JCB marks visible on the machines belong to their owners.

## Fonts

Bundled from npm (`@fontsource/*`), served locally, no Google Fonts request at runtime.

- **Barlow** and **Barlow Condensed** by Jeremy Tribby, SIL Open Font License 1.1
- **JetBrains Mono** by JetBrains, SIL Open Font License 1.1

## Total added asset size

~354 KB (well under the 5 MB budget), no Draco compression needed given the
size. All models load from `frontend/public/`, so nothing depends on a CDN or
external network call at runtime — only drei's `<Environment preset="city">`
does (see the "Environment / reflections" note in the SiteScene handoff notes
for a fallback if that's a concern on demo wifi).
