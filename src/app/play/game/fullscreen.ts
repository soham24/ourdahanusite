export type ImmersiveMode = 'none' | 'fullscreen' | 'focus'
type ElementLike = { requestFullscreen?: () => Promise<void> }
type DocumentLike = { fullscreenElement?: unknown; exitFullscreen?: () => Promise<void> }

export function immersiveModeAnnouncement(mode: ImmersiveMode): string {
  if (mode === 'focus') return 'Fullscreen unavailable. Focus mode enabled.'
  if (mode === 'fullscreen') return 'Fullscreen enabled.'
  return 'Game view exited.'
}

export async function enterImmersive(element: ElementLike, _document: DocumentLike): Promise<ImmersiveMode> {
  void _document
  if (!element.requestFullscreen) return 'focus'

  try {
    await element.requestFullscreen()
    return 'fullscreen'
  } catch {
    return 'focus'
  }
}

export async function exitImmersive(documentLike: DocumentLike): Promise<ImmersiveMode> {
  if (documentLike.fullscreenElement && documentLike.exitFullscreen) {
    try {
      await documentLike.exitFullscreen()
    } catch {
      // State still returns to normal UI.
    }
  }
  return 'none'
}
