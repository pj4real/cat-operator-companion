import { createContext, useContext } from 'react'

/**
 * Where overlays (dialogs, tooltips, the command palette) render. In the tablet frame this is the
 * tablet's screen, so overlays stay inside the device instead of covering the presentation stage.
 */
export const PortalContainer = createContext<HTMLElement | null>(null)
export const usePortalContainer = () => useContext(PortalContainer) ?? undefined
