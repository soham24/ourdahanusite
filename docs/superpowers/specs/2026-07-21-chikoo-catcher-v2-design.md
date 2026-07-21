# Chikoo Catcher v2 — Sunlit Orchard Arcade Upgrade

**Date:** 2026-07-21
**Status:** Approved design, awaiting written-spec review

## Summary

Upgrade the existing `/play` Chikoo Catcher prototype into a polished, fast, replayable arcade experience while preserving its current theme, public leaderboard, authentication rules, and server-side score-saving path. The v2 experience uses a distinctive Sunlit Orchard art direction, progressively increasing difficulty, responsive animation, sound, optional haptics, fullscreen play with a focus-mode fallback, and robust interruption handling.

The implementation remains dependency-free at runtime: Canvas 2D renders the game, `requestAnimationFrame` drives presentation, Web Audio supplies adaptive sound, and standard browser APIs provide fullscreen, persistence, visibility, and vibration capabilities.

## Goals

- Preserve the instantly understandable core loop: catch ripe chikoos and avoid rotten ones.
- Make touch, pointer, and keyboard controls feel immediate and fair.
- Increase speed and pressure continuously as each round progresses.
- Create premium feedback through animation, particles, sound, haptics, and responsive UI.
- Support interruption-free fullscreen play where the browser permits it, with an in-page focus-mode fallback.
- Maintain smooth performance on mobile and desktop, including graceful effect reduction on slower devices.
- Preserve the existing public leaderboard and the rule that anyone may play while only signed-in users may save scores.
- Make optional browser capabilities fail safely without preventing play.

## Non-Goals

- No new game modes, stages, missions, achievements, power-ups, inventory, or meta-progression.
- No third-party game engine, animation library, or runtime audio library.
- No rewrite of the existing Supabase leaderboard architecture.
- No server-authoritative simulation or replay verification.
- No forced orientation lock, because browser support and permission behavior are inconsistent.
- No automatically starting audio before a user gesture.

## Chosen Direction

### Product scope

This is a focused polished-arcade upgrade rather than an expansion or reinvention. The existing catch/avoid mechanics remain the recognizable foundation.

### Art direction: Sunlit Orchard

The game presents a warm Dahanu orchard with coastal daylight, layered foliage, earthy ground, ripe-fruit color, soft depth, and energetic but family-friendly effects. This direction intentionally avoids generic neon-arcade styling and keeps the game visibly connected to OurDahanu's brand.

The visual treatment includes:

- A layered orchard backdrop with restrained parallax.
- Drifting leaves and ambient orchard movement.
- Clearly differentiated ripe and rotten chikoo silhouettes, not color alone.
- Fruit rotation, soft shadows, landing/catch particles, and score bursts.
- A tactile basket with lean, squash, bounce, and recovery animation.
- Warm glass-like HUD surfaces that remain readable over the scene.
- Increasing audiovisual intensity during later game phases without reducing gameplay clarity.

## Gameplay Design

### Controls

- Pointer and touch input map directly to the target basket position with light interpolation to avoid jitter.
- The basket follows quickly enough to feel direct; decorative lean and squash never add input latency.
- Arrow keys move the basket continuously and prevent page scrolling while a round is active.
- All input positions are normalized into logical canvas coordinates and clamped to the playable bounds.
- Collision bounds are slightly more forgiving than the visible fruit and basket edges.

### Round flow

1. The start overlay explains the two object types and provides a one-tap Play action.
2. A short three-beat countdown prepares the player without delaying replay excessively.
3. The round begins at a welcoming speed and ramps continuously.
4. Three missed ripe chikoos or three caught rotten chikoos ends the round, preserving the existing rule.
5. The game-over overlay counts up the final score, compares it with the personal best when available, submits for signed-in users, and offers immediate replay.

Rounds should normally last approximately 45–120 seconds. Skilled play can last longer because difficulty approaches capped values rather than becoming mathematically impossible.

### Difficulty curve

Difficulty is derived from elapsed active play time, excluding countdown and paused time. Interpolation is continuous rather than jumping at fixed ten-second boundaries.

Four presentation phases communicate the curve:

- **Warm-up, 0–15 seconds:** readable fall speed, generous spawn spacing, no lateral fruit drift.
- **Flow, 15–40 seconds:** steadily faster falling and spawning; combo play becomes prominent.
- **Rush, 40–75 seconds:** denser patterns and mild, predictable lateral drift on some fruit.
- **Harvest Rush, 75+ seconds:** near-maximum fall and spawn rates with heightened music and effects.

Fall speed, spawn interval, maximum simultaneous fruit, and lateral drift each have explicit caps in configuration. The implementation plan must define and test the exact curve values in one shared difficulty function so simulation, HUD phase labels, score validation assumptions, and tests cannot diverge.

### Combos and scoring

- Each consecutive ripe catch increments the combo count.
- Missing a ripe chikoo or catching a rotten one resets the combo.
- Combo milestones increase audiovisual feedback and award a conservative integer bonus.
- The submitted score is the number of ripe catches plus earned combo bonuses. Total combo bonus is capped at 20% of ripe catches (rounded down), keeping v2 scores broadly comparable with existing v1 leaderboard scores.
- The server action's accepted maximum must be recalculated from the v2 scoring model and remain aligned with the database constraint.
- Existing stored scores are not changed or migrated; v1 and v2 scores continue to occupy the same leaderboard.
- The HUD displays the current combo, any newly earned bonus, and the total submitted score without presenting a separate competing score value.

### Gameplay feedback

- Ripe catch: fruit pop, droplets/leaf particles, small score burst, basket bounce, pleasant sound, and a short light vibration.
- Combo milestone: warmer glow, larger score burst, rising audio accent, and a distinctive short vibration.
- Miss: brief edge indicator and low error sound; no camera shake strong enough to obscure incoming fruit.
- Rotten catch: muted danger flash, sour sound, restrained camera shake, basket recoil, and a stronger vibration.
- Game over: action freezes cleanly, ambient motion settles, music resolves, and the score overlay animates in.

## Interface and Fullscreen Design

### Responsive play stage

The stage is portrait-first and fills the useful viewport on phones while remaining centered and proportionate on larger screens. It accounts for CSS safe-area insets and uses a stable logical coordinate system independent of display pixels.

The HUD contains score, combo, remaining miss allowance, remaining rotten-catch allowance, pause, audio, and fullscreen/focus controls. Controls use compact, accessible labels and do not cover active spawn or catch zones.

### Fullscreen and focus mode

- A visible fullscreen action appears on the start overlay and active HUD.
- Fullscreen is requested only in direct response to a user gesture.
- When the Fullscreen API is supported and allowed, the game shell—not the whole document—is the fullscreen element.
- When fullscreen is unsupported or rejected, the same action activates focus mode.
- Focus mode uses a fixed viewport-filling game shell above the site chrome; underlying document scrolling is locked and restored on exit.
- Exiting fullscreen or focus mode during a round pauses the game and displays Resume rather than resuming invisibly.
- Orientation changes recalculate the displayed stage and pause until the player confirms Resume.
- No orientation lock is required.

### Overlays and UI states

The game shell has explicit `ready`, `countdown`, `playing`, `paused`, and `gameOver` interface states. Score submission has independent `idle`, `saving`, `saved`, `best`, and `error` states so a network failure never corrupts the round state.

- **Ready:** title, concise controls, object legend, Play, fullscreen/focus, sound, and haptic preferences.
- **Countdown:** three quick beats with input accepted for basket positioning but no fruit simulation.
- **Playing:** compact HUD and unobstructed stage.
- **Paused:** Resume, Restart, audio/haptic preferences, and Exit Fullscreen/Focus Mode.
- **Game over:** animated score, personal-best feedback, save status, Retry Save when appropriate, Play Again, and Exit.

## Sound and Haptics

### Audio

Audio is initialized lazily after the player's first Play or explicit sound action. The audio layer owns its `AudioContext`, master gain, effect scheduling, adaptive music state, suspension, and cleanup.

Required sound cues are countdown, ripe catch, combo milestone, miss, rotten catch, pause/resume, game over, and UI selection. A subtle adaptive orchard rhythm increases intensity across the four gameplay phases. Effects and music share a single user-facing sound toggle for v2.

Audio preferences persist locally with a versioned settings key. Page hiding suspends audio immediately. Returning to a visible page leaves the game paused until explicit resume. Audio initialization or playback failure is swallowed after updating capability state; gameplay continues silently.

### Haptics

Haptics use named vibration patterns behind a capability-safe adapter. The default is enabled on supporting devices and can be disabled from Ready or Paused UI. Catch feedback stays short, damage is stronger, and no pattern is long enough to feel disruptive. Calls are skipped when unsupported, disabled, or the page is hidden.

## Accessibility

- All non-canvas controls are semantic buttons with accessible names and visible focus states.
- Keyboard-only users can start, pause, resume, move, toggle audio, toggle fullscreen/focus mode, restart, and exit.
- Ripe and rotten fruit differ by silhouette, markings, animation, and sound—not color alone.
- A polite live region announces phase changes, pause, damage, game over, save success, and save failure; it does not announce every score increment.
- `prefers-reduced-motion` disables parallax, camera shake, large score movement, and most particles by default.
- The player may use reduced effects automatically or through persisted preferences without changing simulation difficulty.
- Text and controls meet the existing site's contrast and minimum touch-target conventions.
- Canvas has a concise accessible description; gameplay itself is not represented as a noisy DOM mirror.

## Architecture

The route remains a Server Component that fetches authentication and leaderboard data. The interactive game remains a focused Client Component boundary receiving serializable props, consistent with the bundled Next.js 16 documentation.

The monolithic v1 client component will be decomposed by responsibility:

- `src/app/play/game/config.ts`: logical dimensions, difficulty curve, scoring rules, limits, and tuning constants.
- `src/app/play/game/types.ts`: engine state, entities, input, feedback events, settings, and capability types.
- `src/app/play/game/engine.ts`: deterministic fixed-step simulation for spawning, movement, collision, combos, lives, phases, pause, and game over.
- `src/app/play/game/renderer.ts`: high-DPI Canvas 2D drawing, orchard layers, fruit, basket, particles, and canvas-only effects.
- `src/app/play/game/input.ts`: keyboard and pointer normalization plus lifecycle cleanup.
- `src/app/play/game/audio.ts`: lazy Web Audio effects, adaptive music, preference application, suspension, and cleanup.
- `src/app/play/game/haptics.ts`: named vibration patterns and safe capability checks.
- `src/app/play/game/fullscreen.ts`: Fullscreen API helpers, focus-mode state, and capability-safe exit behavior.
- `src/app/play/game/storage.ts`: versioned local preferences with guarded reads and writes.
- `src/app/play/ChikooCatcherGame.tsx`: React orchestration, lifecycle, engine event bridging, and score submission.
- `src/app/play/GameHud.tsx`: active HUD and its accessible controls.
- `src/app/play/GameOverlay.tsx`: ready, countdown, paused, and game-over UI.
- `src/app/play/Leaderboard.tsx`: existing leaderboard presentation, restyled only as needed to match v2.
- `src/app/play/game/*.test.ts`: deterministic engine, difficulty, scoring, settings, and capability-adapter tests using `tsx --test`.

Renderer and feedback systems consume events emitted by the engine. They do not decide scores, collisions, lives, or game-over conditions. React receives throttled display snapshots and meaningful state transitions; per-frame simulation data remains outside React state.

## Data Flow

1. `page.tsx` fetches authentication and leaderboard data on the server.
2. Serializable initial values enter `ChikooCatcherGame` and `Leaderboard`.
3. A Play gesture loads preferences, initializes permitted feedback capabilities, and starts the countdown.
4. Input adapters update a normalized target position or keyboard direction.
5. A fixed-timestep loop advances the pure engine; `requestAnimationFrame` renders the latest interpolated state.
6. Engine events trigger bounded particles, sound, haptics, HUD snapshots, and accessibility announcements.
7. Game over freezes the submitted score and invokes the existing server action for authenticated players.
8. Successful submission refreshes server-rendered leaderboard data. Failure preserves the result and exposes Retry Save.

## Performance Requirements

- Simulation uses a fixed timestep and caps accumulated catch-up work per rendered frame.
- Frame deltas are clamped after pauses and interruptions.
- Falling objects and particles have configured maximum counts; pools or reusable records prevent unbounded allocation.
- Canvas backing resolution respects device pixel ratio but uses a configured upper limit.
- React HUD updates are event-driven or throttled; the component does not render on every animation frame.
- Decorative quality steps down after sustained low frame performance and may recover only after a stable observation window, preventing rapid quality oscillation.
- Reduced quality affects only particles, parallax, shadows, and ambient decoration—not input, collision, spawn timing, or difficulty.
- All animation frames, event listeners, timers, audio nodes, visibility handlers, fullscreen handlers, and scroll locks are cleaned up on restart and unmount.

The target is a visually smooth experience at the display's normal refresh rate, with 60 FPS as the primary test target. Gameplay correctness must remain stable when rendering falls below that target.

## Error and Interruption Handling

- Missing or failed Canvas 2D initialization displays an accessible unable-to-start message instead of a blank stage.
- Audio, vibration, fullscreen, focus mode, and local storage are optional capabilities and never gate starting a round.
- Visibility loss, window blur, fullscreen exit, focus-mode exit, and orientation change pause active play.
- Resuming resets timing accumulators before simulation continues.
- Score submission failure leaves the final score visible and exposes Retry Save; repeated retry uses the same frozen score.
- Restart cancels the previous loop and feedback before creating the next round.
- Fullscreen rejection activates focus mode and communicates the fallback without presenting it as an error.

## Testing Strategy

### Automated tests

Use the project's existing `tsx --test` setup for pure and adapter-level tests:

- Deterministic seeded spawning and phase transitions.
- Continuous difficulty interpolation and every configured cap.
- Ripe catch, miss, rotten catch, combo increment/reset, and both game-over paths.
- Submitted-score invariants and alignment with server/database limits.
- Fixed-step behavior under different render-frame sequences.
- Pause/resume timing reset and absence of post-pause teleporting.
- Object/particle caps and quality-step hysteresis.
- Safe audio, haptic, fullscreen, and storage fallbacks.
- Versioned preference defaults and corrupted-storage recovery.

### Manual and browser verification

- Touch drag, mouse tracking, held arrow keys, keyboard-only controls, and input clamping.
- Ready, countdown, playing, paused, game-over, saving, saved, best, error, retry, and replay states.
- Fullscreen entry/exit and focus-mode fallback.
- Tab switching, window blur, orientation changes, and repeated interruptions.
- Sound enable/disable, browser audio suspension, haptic enable/disable, and unsupported-device behavior.
- Reduced-motion preference and in-game reduced-effects behavior.
- Widths from approximately 320px through desktop, portrait and landscape, including safe areas.
- Signed-out free play and sign-in prompt; signed-in save, refresh, cooldown, and leaderboard update.
- Repeated rounds and navigation away from `/play` without leaked audio, scrolling locks, listeners, or animation loops.

### Regression gates

- Targeted `tsx --test` game tests pass.
- The complete existing test command passes after including the new game test files.
- TypeScript reports no errors.
- ESLint reports no errors or warnings in touched files.
- A clean production build succeeds under Next.js 16.2.1.

## Completion Criteria

The upgrade is complete when:

- The Sunlit Orchard direction is recognizable and consistent across ready, playing, paused, and game-over states.
- Difficulty becomes continuously faster and denser across the documented phases while respecting fair caps.
- Touch, mouse, and keyboard controls remain immediate and accurate at every supported size.
- Sound, haptics, animation, and HUD feedback reinforce catches, mistakes, combos, phases, and game over.
- Fullscreen or focus mode provides interruption-minimized play and exits safely into pause.
- Unsupported optional APIs never prevent play.
- Rendering slowdown cannot alter simulation rules or score correctness.
- Repeated rounds and unmounts leave no active loops, audio, handlers, or scroll locks.
- Existing authentication, score submission, cooldown, and leaderboard behavior remains functional.
- All automated, accessibility, responsive, performance, and production-build checks pass.
