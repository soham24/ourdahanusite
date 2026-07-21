import Link from 'next/link'
import type { ImmersiveMode } from './game/fullscreen'
import type { GameSettings, PlayState, SubmitState } from './game/types'

type OverlayState = Exclude<PlayState, 'playing'>

type OverlayProps =
  | {
      state: Extract<OverlayState, 'ready'>
      settings: GameSettings
      immersiveMode: ImmersiveMode
      onPlay(): void
      onToggleSound(): void
      onToggleHaptics(): void
      onToggleReducedEffects(): void
      onToggleImmersive(): void
    }
  | { state: Extract<OverlayState, 'countdown'>; count: 3 | 2 | 1 }
  | {
      state: Extract<OverlayState, 'paused'>
      settings: GameSettings
      immersiveMode: ImmersiveMode
      onResume(): void
      onRestart(): void
      onExit(): void
      onToggleSound(): void
      onToggleHaptics(): void
      onToggleReducedEffects(): void
    }
  | {
      state: Extract<OverlayState, 'gameOver'>
      score: number
      bestScore: number | null
      submitState: SubmitState
      submitError: string
      isSignedIn: boolean
      onPlayAgain(): void
      onRetrySave(): void
      onExit(): void
    }

interface SettingsControlsProps {
  settings: GameSettings
  onToggleSound(): void
  onToggleHaptics(): void
  onToggleReducedEffects(): void
}

function SettingsControls(props: SettingsControlsProps) {
  const controls = [
    {
      label: 'Sound',
      active: props.settings.sound,
      onClick: props.onToggleSound,
    },
    {
      label: 'Haptics',
      active: props.settings.haptics,
      onClick: props.onToggleHaptics,
    },
    {
      label: 'Reduced effects',
      active: props.settings.reducedEffects,
      onClick: props.onToggleReducedEffects,
    },
  ]

  return (
    <div className="chikoo-overlay__settings" role="group" aria-label="Game settings">
      {controls.map((control) => (
        <button
          key={control.label}
          type="button"
          className="chikoo-setting"
          data-active={control.active}
          aria-label={control.label}
          aria-pressed={control.active}
          onClick={control.onClick}
        >
          <span className="chikoo-setting__mark" aria-hidden="true" />
          <span>{control.label}</span>
          <small aria-hidden="true">{control.active ? 'On' : 'Off'}</small>
        </button>
      ))}
    </div>
  )
}

function PersonalBest({ score, bestScore }: { score: number; bestScore: number | null }) {
  if (bestScore === null) {
    return <p className="chikoo-overlay__comparison">No personal best yet — this harvest sets the pace.</p>
  }

  if (score > bestScore) {
    return (
      <p className="chikoo-overlay__comparison">
        You cleared your best of {bestScore} by {score - bestScore}.
      </p>
    )
  }

  if (score === bestScore) {
    return <p className="chikoo-overlay__comparison">You matched your personal best.</p>
  }

  return (
    <p className="chikoo-overlay__comparison">
      {bestScore - score} short of your personal best of {bestScore}.
    </p>
  )
}

function saveMessage(state: SubmitState, error: string): string {
  switch (state) {
    case 'saving':
      return 'Saving your harvest…'
    case 'saved':
      return 'Score saved.'
    case 'best':
      return 'New personal best saved.'
    case 'error':
      return error || 'Your score could not be saved. Try again.'
    case 'idle':
      return 'Your score is ready to save.'
  }
}

export default function GameOverlay(props: OverlayProps) {
  if (props.state === 'countdown') {
    return (
      <div className="chikoo-overlay chikoo-overlay--countdown" aria-label="Game starting">
        <strong className="chikoo-overlay__count">{props.count}</strong>
      </div>
    )
  }

  if (props.state === 'ready') {
    const immersiveLabel = props.immersiveMode === 'fullscreen'
      ? 'Exit fullscreen'
      : props.immersiveMode === 'focus'
        ? 'Exit focus mode'
        : 'Enter fullscreen'

    return (
      <div className="chikoo-overlay chikoo-overlay--ready">
        <section className="chikoo-overlay__card" aria-labelledby="chikoo-ready-title">
          <p className="chikoo-overlay__eyebrow">Sunlit orchard</p>
          <h2 id="chikoo-ready-title">Chikoo Catcher</h2>
          <p className="chikoo-overlay__intro">Catch ripe chikoos. Dodge the rotten ones.</p>

          <div className="chikoo-overlay__legend" aria-label="Fruit guide">
            <div>
              <span className="chikoo-fruit chikoo-fruit--ripe" aria-hidden="true" />
              <span><strong>Ripe</strong><small>Catch</small></span>
            </div>
            <div>
              <span className="chikoo-fruit chikoo-fruit--rotten" aria-hidden="true" />
              <span><strong>Rotten</strong><small>Dodge</small></span>
            </div>
          </div>

          <div className="chikoo-overlay__actions chikoo-overlay__actions--ready">
            <button type="button" className="chikoo-action chikoo-action--primary" onClick={props.onPlay}>
              Play
            </button>
            <button type="button" className="chikoo-action chikoo-action--quiet" onClick={props.onToggleImmersive}>
              {immersiveLabel}
            </button>
          </div>

          <SettingsControls
            settings={props.settings}
            onToggleSound={props.onToggleSound}
            onToggleHaptics={props.onToggleHaptics}
            onToggleReducedEffects={props.onToggleReducedEffects}
          />
        </section>
      </div>
    )
  }

  if (props.state === 'paused') {
    const exitLabel = props.immersiveMode === 'fullscreen'
      ? 'Exit fullscreen'
      : props.immersiveMode === 'focus'
        ? 'Exit focus mode'
        : 'Exit game view'

    return (
      <div className="chikoo-overlay chikoo-overlay--paused">
        <section className="chikoo-overlay__card" aria-labelledby="chikoo-paused-title">
          <p className="chikoo-overlay__eyebrow">Basket held steady</p>
          <h2 id="chikoo-paused-title">Orchard paused</h2>
          <p className="chikoo-overlay__intro">Your round is safe. Continue when you are ready.</p>

          <div className="chikoo-overlay__actions">
            <button type="button" className="chikoo-action chikoo-action--primary" onClick={props.onResume}>
              Resume
            </button>
            <button type="button" className="chikoo-action chikoo-action--secondary" onClick={props.onRestart}>
              Restart round
            </button>
            <button type="button" className="chikoo-action chikoo-action--quiet" onClick={props.onExit}>
              {exitLabel}
            </button>
          </div>

          <SettingsControls
            settings={props.settings}
            onToggleSound={props.onToggleSound}
            onToggleHaptics={props.onToggleHaptics}
            onToggleReducedEffects={props.onToggleReducedEffects}
          />
        </section>
      </div>
    )
  }

  const statusMessage = props.isSignedIn ? saveMessage(props.submitState, props.submitError) : null

  return (
    <div className="chikoo-overlay chikoo-overlay--game-over">
      <section className="chikoo-overlay__card" aria-labelledby="chikoo-over-title">
        <p className="chikoo-overlay__eyebrow">The basket is in</p>
        <h2 id="chikoo-over-title">Harvest complete</h2>

        <div className="chikoo-overlay__score" aria-label={`Final score ${props.score}`}>
          <span aria-hidden="true">Final score</span>
          <strong aria-hidden="true">{props.score}</strong>
        </div>

        <PersonalBest score={props.score} bestScore={props.bestScore} />

        {props.isSignedIn ? (
          <div className="chikoo-overlay__save" role="status" data-state={props.submitState}>
            <span className="chikoo-overlay__save-mark" aria-hidden="true" />
            <span>{statusMessage}</span>
          </div>
        ) : (
          <div className="chikoo-overlay__signin">
            <p>Sign in to save scores and grow your personal best.</p>
            <Link href="/login?next=/play">Sign in to save</Link>
          </div>
        )}

        <div className="chikoo-overlay__actions">
          {props.isSignedIn && props.submitState === 'error' && (
            <button type="button" className="chikoo-action chikoo-action--secondary" onClick={props.onRetrySave}>
              Retry save
            </button>
          )}
          <button type="button" className="chikoo-action chikoo-action--primary" onClick={props.onPlayAgain}>
            Play again
          </button>
          <button type="button" className="chikoo-action chikoo-action--quiet" onClick={props.onExit}>
            Exit game view
          </button>
        </div>
      </section>
    </div>
  )
}

export function GameUnavailable({ message }: { message: string }) {
  return (
    <div className="chikoo-overlay chikoo-overlay--ready" role="alert">
      <section className="chikoo-overlay__card" aria-labelledby="chikoo-unavailable-title">
        <p className="chikoo-overlay__eyebrow">Game unavailable</p>
        <h2 id="chikoo-unavailable-title">Unable to start Chikoo Catcher</h2>
        <p className="chikoo-overlay__intro">{message}</p>
      </section>
    </div>
  )
}
