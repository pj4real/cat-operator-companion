// Help manual for the docked display: short how-to videos for the Cat 320 (Next Generation),
// from the WilliamAdamsCAT dealer series and Cat. Items with `focus` also have a 3D guide: the
// site view flies into the cab and highlights that control while the video plays.
export type HelpFocus = 'start-button'

export interface HelpItem {
  id: string
  question: string
  category: 'Starting up' | 'Safety' | 'Cab & controls' | 'Care' | 'Technology'
  video: { id: string; title: string; seconds: number; channel: string }
  steps?: string[]
  focus?: HelpFocus
  focusLabel?: string
  featured?: boolean
}

export const HELP: HelpItem[] = [
  {
    id: 'keyless-start', question: 'How do I start the engine without a key?', category: 'Starting up', featured: true,
    video: { id: '9HALT3KGH-E', title: 'Next Generation Cat Excavators Features – Keyless Start', seconds: 56, channel: 'WilliamAdamsCAT' },
    focus: 'start-button', focusLabel: 'Engine start button',
    steps: [
      'Sit down and fasten your seatbelt.',
      'Identify yourself with your Operator ID, as shown in the video.',
      'Press the engine start button on the right-hand console.',
      'Check the monitor for warnings before you move.',
    ],
  },
  {
    id: 'safety', question: 'Which safety features protect me and people nearby?', category: 'Safety', featured: true,
    video: { id: '_gXILEYBB94', title: 'Next Generation Cat Excavators Features – Safety', seconds: 99, channel: 'WilliamAdamsCAT' },
  },
  {
    id: 'camera', question: 'What does the 360° camera show?', category: 'Safety', featured: true,
    video: { id: 'W-EdmUK6tBg', title: 'Next Generation Cat Excavators Features – 360 Safety Cam', seconds: 62, channel: 'WilliamAdamsCAT' },
  },
  {
    id: 'operator-id', question: 'How do I set up my Operator ID and Secure Start?', category: 'Starting up',
    video: { id: 'KwvguKaFliU', title: 'Cat Next Generation Excavators: Starting Machine with Secure Start and Operator ID', seconds: 404, channel: 'Cat' },
  },
  {
    id: 'cab', question: 'How do I adjust the cab and seat?', category: 'Cab & controls',
    video: { id: 'MdMb9ZlzIKw', title: 'Next Generation Cat Excavators Features – Cabin', seconds: 101, channel: 'WilliamAdamsCAT' },
  },
  {
    id: 'controls', question: 'Can I change how the joysticks respond?', category: 'Cab & controls',
    video: { id: 'OUKrjgmsuDo', title: 'Next Generation Cat Excavators Features – Controllability', seconds: 44, channel: 'WilliamAdamsCAT' },
  },
  {
    id: 'ease', question: 'What makes day-to-day operation easier?', category: 'Cab & controls',
    video: { id: '9Cmvde2CCSU', title: 'Next Generation Cat Excavators Features – Ease of Use', seconds: 120, channel: 'WilliamAdamsCAT' },
  },
  {
    id: 'cooling', question: 'How is the engine kept cool on hot days?', category: 'Care',
    video: { id: 'JcJoxZlYsSo', title: 'Next Generation Cat Excavators Features – Cooling', seconds: 79, channel: 'WilliamAdamsCAT' },
  },
  {
    id: 'technology', question: 'What do the grade and payload tools do?', category: 'Technology',
    video: { id: 'XwfFxao3tyI', title: 'Next Generation Cat Excavators Features – Technology', seconds: 134, channel: 'WilliamAdamsCAT' },
  },
  {
    id: 'lift-assist', question: 'How does Lift Assist help with a lift?', category: 'Technology',
    video: { id: '2ky_fFqqwGg', title: 'Cat Lift Assist for Excavators', seconds: 22, channel: 'Cat' },
  },
]
