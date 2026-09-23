// Product photos for each machine type (cut out from freely licensed Wikimedia Commons photos,
// credits in THIRD_PARTY_ASSETS.md). Keyed by machine kind, so any asset of that kind gets a picture.
const IMAGES: { match: RegExp; src: string; alt: string }[] = [
  { match: /^excavator/i, src: '/machines/excavator.webp', alt: 'Cat 320 hydraulic excavator' },
  { match: /^wheel loader/i, src: '/machines/wheel-loader.webp', alt: 'Cat 950 wheel loader' },
  { match: /^dumper|articulated/i, src: '/machines/dumper.webp', alt: 'Cat articulated dump truck' },
  { match: /^backhoe/i, src: '/machines/backhoe.webp', alt: 'JCB backhoe loader' },
]

export function machineImage(kind: string) {
  return IMAGES.find((i) => i.match.test(kind)) ?? null
}
