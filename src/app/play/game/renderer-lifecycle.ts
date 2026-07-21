import { createRenderer } from './renderer'
import type { GameRenderer } from './renderer'

export type RendererInitialization =
  | { renderer: GameRenderer; error: null }
  | { renderer: null; error: string }

export function initializeRenderer(canvas: HTMLCanvasElement): RendererInitialization {
  try {
    return { renderer: createRenderer(canvas), error: null }
  } catch {
    return {
      renderer: null,
      error: 'This browser cannot start Chikoo Catcher because canvas rendering is unavailable.',
    }
  }
}
