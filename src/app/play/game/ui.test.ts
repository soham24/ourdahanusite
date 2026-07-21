import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import GameOverlay, { GameUnavailable } from '../GameOverlay'
import { DEFAULT_SETTINGS } from './storage'

const noop = () => undefined

test('ready overlay labels focus mode action as an exit', () => {
  const html = renderToStaticMarkup(createElement(GameOverlay, {
    state: 'ready',
    settings: DEFAULT_SETTINGS,
    immersiveMode: 'focus',
    onPlay: noop,
    onToggleSound: noop,
    onToggleHaptics: noop,
    onToggleReducedEffects: noop,
    onToggleImmersive: noop,
  }))

  assert.match(html, />Exit focus mode</)
  assert.doesNotMatch(html, />Enter fullscreen</)
})

test('renderer failure is a semantic alert with no playable start action', () => {
  const html = renderToStaticMarkup(createElement(GameUnavailable, {
    message: 'Canvas unavailable.',
  }))

  assert.match(html, /role="alert"/)
  assert.match(html, /Canvas unavailable\./)
  assert.doesNotMatch(html, />Play</)
})
