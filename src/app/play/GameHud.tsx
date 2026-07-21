import { Expand, Minimize, Pause, Volume2, VolumeX } from 'lucide-react'
import type { ImmersiveMode } from './game/fullscreen'
import type { GameSnapshot } from './game/types'

interface GameHudProps {
  snapshot: GameSnapshot
  soundEnabled: boolean
  immersiveMode: ImmersiveMode
  onPause(): void
  onToggleSound(): void
  onToggleImmersive(): void
}

export default function GameHud(props: GameHudProps) {
  const { snapshot } = props

  return (
    <div className="chikoo-hud" role="group" aria-label="Game status and controls">
      <div className="chikoo-hud__score">
        <span>Score</span>
        <strong>{snapshot.score}</strong>
      </div>
      <div className="chikoo-hud__combo" data-active={snapshot.combo >= 2}>
        <span>Combo</span>
        <strong>×{snapshot.combo}</strong>
      </div>
      <div
        className="chikoo-hud__lives"
        aria-label={`${3 - snapshot.misses} misses and ${3 - snapshot.badCatches} bad catches remaining`}
      >
        <span aria-hidden="true">🟤 {3 - snapshot.misses}</span>
        <span aria-hidden="true">⚠ {3 - snapshot.badCatches}</span>
      </div>
      <div className="chikoo-hud__actions">
        <button
          type="button"
          onClick={props.onToggleSound}
          aria-label={props.soundEnabled ? 'Mute game sound' : 'Enable game sound'}
          aria-pressed={props.soundEnabled}
        >
          {props.soundEnabled ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
        </button>
        <button type="button" onClick={props.onPause} aria-label="Pause game">
          <Pause aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={props.onToggleImmersive}
          aria-label={props.immersiveMode === 'none' ? 'Enter fullscreen' : 'Exit fullscreen'}
        >
          {props.immersiveMode === 'none' ? (
            <Expand aria-hidden="true" />
          ) : (
            <Minimize aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  )
}
