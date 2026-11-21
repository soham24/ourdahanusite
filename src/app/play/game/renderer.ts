import { GAME_CONFIG } from './config'
import type { GameEvent, GamePhase, GameSettings, PowerUpKind, GameSnapshot, QualityLevel } from './types'

const MAX_PARTICLES = 96
const MAX_BURSTS = 12
const BOUNCE_MS = 220
const BANNER_MS = 1_400
const SHAKE_DURATION_MS = 110
const DANGER_PULSE_MS = 420
const TAU = Math.PI * 2

interface Particle {
  active: boolean
  x: number
  y: number
  vx: number
  vy: number
  ageMs: number
  durationMs: number
  radius: number
  color: string
}

interface ScoreBurst {
  active: boolean
  x: number
  y: number
  ageMs: number
  durationMs: number
  text: string
  color: string
  /** An expanding ring as well as the text: combo bonuses and golden catches. */
  ring: boolean
  size: number
}

interface Banner {
  text: string
  color: string
  ageMs: number
  /** A smaller second line, e.g. "+1 life" under a milestone. */
  sub?: string
}

export interface QualityController {
  observe(frameMs: number): void
  current(): QualityLevel
}

export interface GameRenderer {
  resize(cssWidth: number, cssHeight: number, devicePixelRatio: number): void
  setPointerX(logicalX: number | null): void
  emit(events: readonly GameEvent[]): void
  /** A short message across the middle of the play area, e.g. "New best!". */
  announce(text: string, color?: string): void
  render(snapshot: GameSnapshot, settings: GameSettings, frameMs: number): void
  clear(): void
  destroy(): void
}

export const getBackingScale = (devicePixelRatio: number) =>
  Math.min(2, Math.max(1, devicePixelRatio || 1))

export function createQualityController(): QualityController {
  let level: QualityLevel = 'high'
  let slowFrames = 0
  let healthyFrames = 0

  return {
    observe(frameMs: number) {
      if (frameMs > 20) {
        slowFrames += 1
        healthyFrames = 0
      } else if (frameMs < 18) {
        healthyFrames += 1
        slowFrames = Math.max(0, slowFrames - 1)
      }
      if (level === 'high' && slowFrames >= 90) level = 'reduced'
      if (level === 'reduced' && healthyFrames >= 240) {
        level = 'high'
        slowFrames = 0
      }
    },
    current: () => level,
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const normalizeFrameMs = (frameMs: number) =>
  Math.max(0, Number.isFinite(frameMs) ? frameMs : 0)

export function getParallaxTarget(
  pointerX: number | null,
  quality: QualityLevel,
  reducedEffects: boolean,
) {
  if (pointerX === null || !Number.isFinite(pointerX) || quality === 'reduced' || reducedEffects) {
    return 0
  }
  return clamp((pointerX / GAME_CONFIG.width - 0.5) * 12, -6, 6)
}

export function getNextParallaxX(
  currentX: number,
  pointerX: number | null,
  quality: QualityLevel,
  reducedEffects: boolean,
) {
  if (pointerX === null || !Number.isFinite(pointerX) || quality === 'reduced' || reducedEffects) {
    return 0
  }
  const targetX = getParallaxTarget(pointerX, quality, reducedEffects)
  return clamp(currentX + (targetX - currentX) * 0.12, -6, 6)
}

export function advanceEffectDuration(remainingMs: number, frameMs: number) {
  return Math.max(0, remainingMs - normalizeFrameMs(frameMs))
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2)
  context.beginPath()
  context.moveTo(x + safeRadius, y)
  context.lineTo(x + width - safeRadius, y)
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius)
  context.lineTo(x + width, y + height - safeRadius)
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height)
  context.lineTo(x + safeRadius, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius)
  context.lineTo(x, y + safeRadius)
  context.quadraticCurveTo(x, y, x + safeRadius, y)
  context.closePath()
}

function drawBackground(context: CanvasRenderingContext2D, parallaxX: number, quality: QualityLevel) {
  const sky = context.createLinearGradient(0, 0, 0, 430)
  sky.addColorStop(0, '#77C9E8')
  sky.addColorStop(1, '#DDF3C7')
  context.fillStyle = sky
  context.fillRect(-8, -8, GAME_CONFIG.width + 16, GAME_CONFIG.height + 16)

  const glow = context.createRadialGradient(292, 88, 4, 292, 88, 94)
  glow.addColorStop(0, 'rgba(255, 216, 106, 0.72)')
  glow.addColorStop(0.42, 'rgba(255, 216, 106, 0.22)')
  glow.addColorStop(1, 'rgba(255, 216, 106, 0)')
  context.fillStyle = glow
  context.fillRect(188, 0, 172, 190)

  context.save()
  context.translate(parallaxX * 0.22, 0)
  context.fillStyle = '#89A867'
  context.beginPath()
  context.moveTo(-20, 355)
  context.quadraticCurveTo(42, 280, 112, 348)
  context.quadraticCurveTo(178, 252, 240, 341)
  context.quadraticCurveTo(310, 276, 386, 350)
  context.lineTo(386, 455)
  context.lineTo(-20, 455)
  context.closePath()
  context.fill()
  context.restore()

  context.save()
  context.translate(parallaxX * 0.58, 0)
  context.fillStyle = '#315C35'
  context.beginPath()
  context.moveTo(-28, 0)
  context.lineTo(388, 0)
  context.lineTo(388, 104)
  context.bezierCurveTo(344, 93, 330, 153, 291, 130)
  context.bezierCurveTo(258, 112, 239, 174, 199, 137)
  context.bezierCurveTo(164, 104, 128, 168, 98, 129)
  context.bezierCurveTo(67, 91, 38, 157, -28, 122)
  context.closePath()
  context.fill()

  context.fillStyle = 'rgba(205, 230, 137, 0.18)'
  for (const [x, y, radius] of [
    [34, 86, 18],
    [113, 104, 14],
    [217, 92, 17],
    [310, 110, 14],
  ] as const) {
    context.beginPath()
    context.arc(x, y, radius, 0, TAU)
    context.fill()
  }
  context.restore()

  context.save()
  context.translate(parallaxX, 0)
  context.fillStyle = '#21452D'
  context.beginPath()
  context.moveTo(-34, 0)
  context.lineTo(394, 0)
  context.lineTo(394, 55)
  context.bezierCurveTo(344, 46, 347, 108, 300, 90)
  context.bezierCurveTo(259, 74, 256, 130, 211, 101)
  context.bezierCurveTo(172, 73, 149, 128, 114, 92)
  context.bezierCurveTo(73, 53, 39, 117, -34, 76)
  context.closePath()
  context.fill()

  context.fillStyle = 'rgba(120, 158, 75, 0.42)'
  const leaves = quality === 'high'
    ? [[22, 47], [66, 76], [140, 62], [188, 91], [264, 55], [330, 78]]
    : [[66, 76], [188, 91], [330, 78]]
  for (const [x, y] of leaves) {
    context.save()
    context.translate(x, y)
    context.rotate(-0.45)
    context.beginPath()
    context.ellipse(0, 0, 11, 4, 0, 0, TAU)
    context.fill()
    context.restore()
  }
  context.restore()

  const ground = context.createLinearGradient(0, 390, 0, GAME_CONFIG.height)
  ground.addColorStop(0, '#75502E')
  ground.addColorStop(1, '#3D2A19')
  context.fillStyle = ground
  context.beginPath()
  context.moveTo(-8, 408)
  context.quadraticCurveTo(80, 389, 170, 408)
  context.quadraticCurveTo(266, 429, 368, 400)
  context.lineTo(368, 648)
  context.lineTo(-8, 648)
  context.closePath()
  context.fill()

  context.strokeStyle = 'rgba(226, 183, 104, 0.12)'
  context.lineWidth = 1
  for (let index = 0; index < 7; index += 1) {
    const y = 449 + index * 27
    context.beginPath()
    context.moveTo(12 + (index % 2) * 14, y)
    context.quadraticCurveTo(168, y - 12, 348, y + 3)
    context.stroke()
  }
}

function drawRipeFruit(context: CanvasRenderingContext2D, x: number, y: number, rotation: number) {
  context.save()
  context.translate(x, y)
  context.rotate(rotation)

  const fruit = context.createRadialGradient(-6, -7, 2, 1, 2, GAME_CONFIG.itemRadius + 2)
  fruit.addColorStop(0, '#C88C50')
  fruit.addColorStop(0.58, '#9A6035')
  fruit.addColorStop(1, '#633B24')
  context.fillStyle = fruit
  context.beginPath()
  context.arc(0, 0, GAME_CONFIG.itemRadius, 0, TAU)
  context.fill()

  context.strokeStyle = '#4C3320'
  context.lineWidth = 2.3
  context.lineCap = 'round'
  context.beginPath()
  context.moveTo(1, -15)
  context.quadraticCurveTo(3, -21, 7, -23)
  context.stroke()

  context.fillStyle = '#55743A'
  context.beginPath()
  context.ellipse(10, -19, 7, 3.3, 0.38, 0, TAU)
  context.fill()

  context.fillStyle = 'rgba(255, 230, 173, 0.62)'
  context.beginPath()
  context.ellipse(-6, -7, 4.3, 2.5, -0.65, 0, TAU)
  context.fill()
  context.restore()
}

function drawRottenFruit(context: CanvasRenderingContext2D, x: number, y: number, rotation: number) {
  context.save()
  context.translate(x, y)
  context.rotate(rotation)
  context.fillStyle = '#756D4B'
  context.strokeStyle = '#3E3D2A'
  context.lineWidth = 2
  context.beginPath()
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * TAU
    const radius = GAME_CONFIG.itemRadius * (index % 3 === 0 ? 0.83 : index % 2 === 0 ? 1.04 : 0.94)
    const px = Math.cos(angle) * radius
    const py = Math.sin(angle) * radius
    if (index === 0) context.moveTo(px, py)
    else context.lineTo(px, py)
  }
  context.closePath()
  context.fill()
  context.stroke()

  context.fillStyle = '#403426'
  for (const [spotX, spotY, radius] of [[-6, -5, 4], [7, 4, 3.2], [-1, 9, 2.2]] as const) {
    context.beginPath()
    context.arc(spotX, spotY, radius, 0, TAU)
    context.fill()
  }

  context.strokeStyle = '#2C241D'
  context.lineWidth = 1.7
  context.beginPath()
  context.moveTo(7, -8)
  context.quadraticCurveTo(13, -13, 16, -8)
  context.quadraticCurveTo(13, -4, 9, -7)
  context.stroke()
  context.beginPath()
  context.moveTo(13, -10)
  context.lineTo(16, -13)
  context.moveTo(13, -7)
  context.lineTo(17, -5)
  context.stroke()
  context.restore()
}

interface BasketLook {
  /** 1, or wider while the big-basket power-up lasts. */
  widthScale: number
  /** 1 just after a catch, easing to 0. */
  bounce: number
  /** 0 none, 1 warm (10+ in a row), 2 hot (20+). */
  glow: 0 | 1 | 2
  /** One timer bar per running top-up: how much is left, in its colour. */
  bars: { fraction: number; color: string }[]
  /** Double harvest: the basket shines gold. */
  golden: boolean
}

function drawBasket(context: CanvasRenderingContext2D, x: number, velocity: number, look: BasketLook) {
  if (look.glow > 0) {
    const glow = context.createRadialGradient(x, GAME_CONFIG.basketY + 14, 8, x, GAME_CONFIG.basketY + 14, 70 * look.widthScale)
    glow.addColorStop(0, look.glow === 2 ? 'rgba(255, 140, 60, 0.55)' : 'rgba(255, 214, 110, 0.45)')
    glow.addColorStop(1, 'rgba(255, 180, 80, 0)')
    context.fillStyle = glow
    context.fillRect(x - 80 * look.widthScale, GAME_CONFIG.basketY - 50, 160 * look.widthScale, 110)
  }
  if (look.golden) {
    const shine = context.createRadialGradient(x, GAME_CONFIG.basketY + 14, 6, x, GAME_CONFIG.basketY + 14, 64 * look.widthScale)
    shine.addColorStop(0, 'rgba(255, 216, 106, 0.5)')
    shine.addColorStop(1, 'rgba(255, 216, 106, 0)')
    context.fillStyle = shine
    context.fillRect(x - 72 * look.widthScale, GAME_CONFIG.basketY - 44, 144 * look.widthScale, 100)
  }
  const barWidth = GAME_CONFIG.basketWidth * look.widthScale
  look.bars.forEach((bar, index) => {
    const y = GAME_CONFIG.basketY - 30 - index * 7
    context.fillStyle = 'rgba(46, 18, 5, 0.25)'
    roundedRect(context, x - barWidth / 2, y, barWidth, 5, 2.5)
    context.fill()
    context.fillStyle = bar.color
    roundedRect(context, x - barWidth / 2, y, barWidth * bar.fraction, 5, 2.5)
    context.fill()
  })
  context.save()
  context.translate(x, GAME_CONFIG.basketY + 3)
  context.rotate(clamp(velocity / 900, -0.12, 0.12))
  // Squash on a catch, stretch wide for the power-up.
  context.scale(look.widthScale * (1 + look.bounce * 0.07), 1 - look.bounce * 0.13)

  context.fillStyle = 'rgba(33, 21, 13, 0.28)'
  context.beginPath()
  context.ellipse(0, 36, 45, 8, 0, 0, TAU)
  context.fill()

  context.strokeStyle = '#B77A3E'
  context.lineWidth = 6
  context.beginPath()
  context.ellipse(0, 2, 29, 25, 0, Math.PI, TAU)
  context.stroke()
  context.strokeStyle = '#6E4227'
  context.lineWidth = 1.6
  context.beginPath()
  context.ellipse(0, 2, 29, 25, 0, Math.PI, TAU)
  context.stroke()

  const basketGradient = context.createLinearGradient(0, 2, 0, 36)
  basketGradient.addColorStop(0, '#CB8B47')
  basketGradient.addColorStop(1, '#81502E')
  context.fillStyle = basketGradient
  roundedRect(
    context,
    -GAME_CONFIG.basketWidth / 2,
    0,
    GAME_CONFIG.basketWidth,
    GAME_CONFIG.basketHeight,
    9,
  )
  context.fill()
  context.strokeStyle = '#5F3923'
  context.lineWidth = 2
  context.stroke()

  context.save()
  roundedRect(
    context,
    -GAME_CONFIG.basketWidth / 2 + 2,
    2,
    GAME_CONFIG.basketWidth - 4,
    GAME_CONFIG.basketHeight - 4,
    7,
  )
  context.clip()
  context.strokeStyle = 'rgba(255, 207, 126, 0.52)'
  context.lineWidth = 3
  for (let y = 7; y < 34; y += 8) {
    context.beginPath()
    context.moveTo(-40, y)
    context.quadraticCurveTo(0, y + 3, 40, y)
    context.stroke()
  }
  context.strokeStyle = 'rgba(88, 47, 25, 0.52)'
  context.lineWidth = 2
  for (let xBand = -31; xBand <= 31; xBand += 12) {
    context.beginPath()
    context.moveTo(xBand - 3, 1)
    context.lineTo(xBand + 3, 35)
    context.stroke()
  }
  context.restore()

  context.strokeStyle = '#E0A65A'
  context.lineWidth = 3
  context.beginPath()
  context.moveTo(-34, 5)
  context.quadraticCurveTo(0, 9, 34, 5)
  context.stroke()
  context.restore()
}

function drawDangerPulse(context: CanvasRenderingContext2D, ageMs: number, x: number) {
  if (ageMs >= DANGER_PULSE_MS) return
  const progress = ageMs / DANGER_PULSE_MS
  const opacity = Math.sin(progress * Math.PI) * 0.52
  const edge = context.createLinearGradient(0, GAME_CONFIG.height - 54, 0, GAME_CONFIG.height)
  edge.addColorStop(0, 'rgba(171, 57, 34, 0)')
  edge.addColorStop(1, `rgba(171, 57, 34, ${opacity})`)
  context.fillStyle = edge
  context.fillRect(0, GAME_CONFIG.height - 54, GAME_CONFIG.width, 54)
  context.strokeStyle = `rgba(246, 181, 88, ${opacity * 0.85})`
  context.lineWidth = 2
  context.beginPath()
  context.arc(clamp(x, 18, GAME_CONFIG.width - 18), GAME_CONFIG.height + 2, 22 + progress * 15, Math.PI, TAU)
  context.stroke()
}

function drawGoldenFruit(context: CanvasRenderingContext2D, x: number, y: number, rotation: number, clockMs: number) {
  // A slow pulse and four twinkling points, so it reads as special at a glance.
  const pulse = 0.5 + 0.5 * Math.sin(clockMs / 160)
  const halo = context.createRadialGradient(x, y, 4, x, y, GAME_CONFIG.itemRadius * 2.4)
  halo.addColorStop(0, `rgba(255, 226, 120, ${0.55 + pulse * 0.25})`)
  halo.addColorStop(1, 'rgba(255, 226, 120, 0)')
  context.fillStyle = halo
  context.fillRect(x - 44, y - 44, 88, 88)

  context.save()
  context.translate(x, y)
  context.rotate(rotation)
  const fruit = context.createRadialGradient(-6, -7, 2, 1, 2, GAME_CONFIG.itemRadius + 2)
  fruit.addColorStop(0, '#FFF1B3')
  fruit.addColorStop(0.5, '#F2C14E')
  fruit.addColorStop(1, '#B07A12')
  context.fillStyle = fruit
  context.beginPath()
  context.arc(0, 0, GAME_CONFIG.itemRadius, 0, TAU)
  context.fill()
  context.strokeStyle = '#8A5B0B'
  context.lineWidth = 1.5
  context.stroke()

  context.strokeStyle = '#4C3320'
  context.lineWidth = 2.3
  context.lineCap = 'round'
  context.beginPath()
  context.moveTo(1, -15)
  context.quadraticCurveTo(3, -21, 7, -23)
  context.stroke()
  context.fillStyle = '#6E8F3E'
  context.beginPath()
  context.ellipse(10, -19, 7, 3.3, 0.38, 0, TAU)
  context.fill()
  context.restore()

  context.strokeStyle = `rgba(255, 250, 220, ${0.45 + pulse * 0.55})`
  context.lineWidth = 1.6
  context.lineCap = 'round'
  for (let index = 0; index < 4; index += 1) {
    const angle = clockMs / 700 + (index * TAU) / 4
    const sx = x + Math.cos(angle) * 25
    const sy = y + Math.sin(angle) * 25
    const size = 2.5 + pulse * 2
    context.beginPath()
    context.moveTo(sx - size, sy)
    context.lineTo(sx + size, sy)
    context.moveTo(sx, sy - size)
    context.lineTo(sx, sy + size)
    context.stroke()
  }
}

/** A ringed token with a soft pulsing halo; `drawSymbol` adds what it does. */
function drawToken(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  clockMs: number,
  colors: { halo: string; fill: string; ring: string },
  drawSymbol: () => void,
) {
  const pulse = 0.5 + 0.5 * Math.sin(clockMs / 130)
  const halo = context.createRadialGradient(x, y, 6, x, y, 40)
  halo.addColorStop(0, `rgba(${colors.halo}, ${0.5 + pulse * 0.3})`)
  halo.addColorStop(1, `rgba(${colors.halo}, 0)`)
  context.fillStyle = halo
  context.fillRect(x - 40, y - 40, 80, 80)
  context.save()
  context.translate(x, y)
  context.fillStyle = colors.fill
  context.strokeStyle = colors.ring
  context.lineWidth = 3
  context.beginPath()
  context.arc(0, 0, GAME_CONFIG.itemRadius + 2, 0, TAU)
  context.fill()
  context.stroke()
  drawSymbol()
  context.restore()
}

/** Monsoon breeze: a rain cloud. Everything falls slower for a while. */
function drawSlowFallToken(context: CanvasRenderingContext2D, x: number, y: number, clockMs: number) {
  drawToken(context, x, y, clockMs, { halo: '110, 170, 220', fill: '#EEF6FC', ring: '#3F7FB5' }, () => {
    context.fillStyle = '#7FA9CC'
    context.beginPath()
    context.ellipse(-4, -3, 7, 5.5, 0, 0, TAU)
    context.ellipse(4, -4, 6.5, 6, 0, 0, TAU)
    context.ellipse(0, -1, 10, 4.5, 0, 0, TAU)
    context.fill()
    context.strokeStyle = '#3F7FB5'
    context.lineWidth = 1.8
    context.lineCap = 'round'
    for (const dx of [-5, 0, 5]) {
      context.beginPath()
      context.moveTo(dx, 6)
      context.lineTo(dx - 1.5, 10)
      context.stroke()
    }
  })
}

/** Double harvest: a gold coin marked x2. */
function drawDoubleHarvestToken(context: CanvasRenderingContext2D, x: number, y: number, clockMs: number) {
  drawToken(context, x, y, clockMs, { halo: '255, 200, 80', fill: '#FFD86A', ring: '#B07A12' }, () => {
    context.strokeStyle = '#7A4F08'
    context.lineWidth = 2.6
    context.lineCap = 'round'
    context.lineJoin = 'round'
    // "x"
    context.beginPath()
    context.moveTo(-10, -4)
    context.lineTo(-3, 4)
    context.moveTo(-3, -4)
    context.lineTo(-10, 4)
    // "2"
    context.moveTo(1, -4)
    context.quadraticCurveTo(5, -9, 9, -4)
    context.quadraticCurveTo(10, -1, 1, 6)
    context.lineTo(10, 6)
    context.stroke()
  })
}

/** The heart: one lost life back. Only falls once a life is lost. */
function drawHeartToken(context: CanvasRenderingContext2D, x: number, y: number, clockMs: number) {
  const beat = 1 + 0.08 * Math.max(0, Math.sin(clockMs / 110))
  const halo = context.createRadialGradient(x, y, 6, x, y, 40)
  halo.addColorStop(0, 'rgba(240, 90, 90, 0.6)')
  halo.addColorStop(1, 'rgba(240, 90, 90, 0)')
  context.fillStyle = halo
  context.fillRect(x - 40, y - 40, 80, 80)
  context.save()
  context.translate(x, y)
  context.scale(beat, beat)
  context.fillStyle = '#E0474C'
  context.strokeStyle = '#8E1F25'
  context.lineWidth = 2.5
  context.beginPath()
  context.moveTo(0, 13)
  context.bezierCurveTo(-22, -1, -13, -20, 0, -8)
  context.bezierCurveTo(13, -20, 22, -1, 0, 13)
  context.closePath()
  context.fill()
  context.stroke()
  context.fillStyle = 'rgba(255, 255, 255, 0.55)'
  context.beginPath()
  context.ellipse(-7, -7, 3.5, 2.2, -0.6, 0, TAU)
  context.fill()
  context.restore()
}

function drawBigBasketPowerUp(context: CanvasRenderingContext2D, x: number, y: number, clockMs: number) {
  const pulse = 0.5 + 0.5 * Math.sin(clockMs / 130)
  const halo = context.createRadialGradient(x, y, 6, x, y, 40)
  halo.addColorStop(0, `rgba(142, 173, 86, ${0.5 + pulse * 0.3})`)
  halo.addColorStop(1, 'rgba(142, 173, 86, 0)')
  context.fillStyle = halo
  context.fillRect(x - 40, y - 40, 80, 80)

  context.save()
  context.translate(x, y)
  context.fillStyle = '#FFF8E8'
  context.strokeStyle = '#5E7F2E'
  context.lineWidth = 3
  context.beginPath()
  context.arc(0, 0, GAME_CONFIG.itemRadius + 2, 0, TAU)
  context.fill()
  context.stroke()

  // A small basket with arrows either side: "wider".
  context.fillStyle = '#B77A3E'
  roundedRect(context, -8, -1, 16, 9, 3)
  context.fill()
  context.strokeStyle = '#6E4227'
  context.lineWidth = 1.6
  context.beginPath()
  context.ellipse(0, 0, 6, 6, 0, Math.PI, TAU)
  context.stroke()
  context.strokeStyle = '#5E7F2E'
  context.lineWidth = 2
  context.lineCap = 'round'
  for (const side of [-1, 1]) {
    context.beginPath()
    context.moveTo(side * 11, 3)
    context.lineTo(side * 16, 3)
    context.moveTo(side * 14, 0)
    context.lineTo(side * 16, 3)
    context.lineTo(side * 14, 6)
    context.stroke()
  }
  context.restore()
}

/** Pulsing red edges when one more mistake ends the game. */
function drawLastChance(context: CanvasRenderingContext2D, clockMs: number) {
  const alpha = 0.16 + 0.12 * (0.5 + 0.5 * Math.sin(clockMs / 220))
  const edge = 46
  const sides: Array<[number, number, number, number, number, number, number, number]> = [
    [0, 0, GAME_CONFIG.width, edge, 0, 0, 0, edge],
    [0, GAME_CONFIG.height - edge, GAME_CONFIG.width, edge, 0, GAME_CONFIG.height, 0, GAME_CONFIG.height - edge],
    [0, 0, edge, GAME_CONFIG.height, 0, 0, edge, 0],
    [GAME_CONFIG.width - edge, 0, edge, GAME_CONFIG.height, GAME_CONFIG.width, 0, GAME_CONFIG.width - edge, 0],
  ]
  for (const [rx, ry, rw, rh, x0, y0, x1, y1] of sides) {
    const gradient = context.createLinearGradient(x0, y0, x1, y1)
    gradient.addColorStop(0, `rgba(190, 40, 30, ${alpha})`)
    gradient.addColorStop(1, 'rgba(190, 40, 30, 0)')
    context.fillStyle = gradient
    context.fillRect(rx, ry, rw, rh)
  }
}

const POWER_UP_BANNERS: Record<PowerUpKind, [string, string]> = {
  bigBasket: ['Big basket!', '#D8F0B0'],
  slowFall: ['Monsoon breeze', '#CFE6F7'],
  doubleHarvest: ['Double harvest \u00d72', '#FFD86A'],
  extraLife: ['Extra life!', '#FFB3B3'],
}

const TIMER_BARS: { field: 'bigBasketMs' | 'slowFallMs' | 'doubleHarvestMs'; total: number; color: string }[] = [
  { field: 'bigBasketMs', total: GAME_CONFIG.bigBasketMs, color: '#8EAD56' },
  { field: 'slowFallMs', total: GAME_CONFIG.slowFallMs, color: '#5B9BD0' },
  { field: 'doubleHarvestMs', total: GAME_CONFIG.doubleHarvestMs, color: '#F2C14E' },
]

/** One bar per running top-up, in a fixed order so they never jump around. */
export const timerBars = (snapshot: Pick<GameSnapshot, 'bigBasketMs' | 'slowFallMs' | 'doubleHarvestMs'>) =>
  TIMER_BARS.filter((bar) => snapshot[bar.field] > 0).map((bar) => ({
    fraction: Math.min(1, snapshot[bar.field] / bar.total),
    color: bar.color,
  }))

const PHASE_BANNERS: Partial<Record<GamePhase, string>> = {
  flow: 'Picking up pace',
  rush: 'Rush!',
  harvestRush: 'Harvest rush!',
}

export function createRenderer(canvas: HTMLCanvasElement): GameRenderer {
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) throw new Error('Canvas 2D rendering is unavailable')

  let quality = createQualityController()
  let renderedQuality: QualityLevel = 'high'
  let reducedEffects = false
  let pointerX: number | null = null
  let parallaxX = 0
  let shakeRemainingMs = 0
  let dangerAgeMs = DANGER_PULSE_MS
  let dangerX = GAME_CONFIG.width / 2
  let destroyed = false
  let clockMs = 0
  let bounceMs = 0
  let banner: Banner | null = null
  const particles: Particle[] = []
  const bursts: ScoreBurst[] = []

  const allocateParticle = (): Particle | null => {
    const available = particles.find((particle) => !particle.active)
    if (available) return available
    if (particles.length >= MAX_PARTICLES) return null
    const particle: Particle = {
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      ageMs: 0,
      durationMs: 0,
      radius: 0,
      color: '#FFD86A',
    }
    particles.push(particle)
    return particle
  }

  const allocateBurst = (): ScoreBurst | null => {
    const available = bursts.find((burst) => !burst.active)
    if (available) return available
    if (bursts.length >= MAX_BURSTS) return null
    const burst: ScoreBurst = { active: false, x: 0, y: 0, ageMs: 0, durationMs: 0, text: '', color: '', ring: false, size: 12 }
    bursts.push(burst)
    return burst
  }

  const addCatchParticles = (x: number, y: number, golden = false) => {
    const count = reducedEffects ? 2 : renderedQuality === 'high' ? (golden ? 16 : 10) : 4
    for (let index = 0; index < count; index += 1) {
      const particle = allocateParticle()
      if (!particle) break
      const angle = (index / count) * TAU + Math.random() * 0.42
      const speed = 38 + Math.random() * 58
      particle.active = true
      particle.x = x
      particle.y = y
      particle.vx = Math.cos(angle) * speed
      particle.vy = Math.sin(angle) * speed - 28
      particle.ageMs = 0
      particle.durationMs = 390 + Math.random() * 190
      particle.radius = 1.7 + Math.random() * 1.8
      particle.color = golden
        ? index % 2 === 0 ? '#FFE38A' : '#F2C14E'
        : index % 3 === 0 ? '#F7D46A' : index % 2 === 0 ? '#8EAD56' : '#D9964A'
    }
  }

  // Every point earned floats up from where it was caught; the pool is
  // capped, so a flurry of catches never piles up text.
  const popScore = (x: number, y: number, text: string, color: string, ring: boolean, size: number) => {
    if (reducedEffects) return
    const burst = allocateBurst()
    if (!burst) return
    burst.active = true
    burst.x = x
    burst.y = y
    burst.ageMs = 0
    burst.durationMs = ring ? 760 : 620
    burst.text = text
    burst.color = color
    burst.ring = ring
    burst.size = size
  }

  const announce = (text: string, color = '#FFF4D6', sub?: string) => {
    if (destroyed) return
    banner = { text, color, ageMs: 0, sub }
  }

  const emit = (events: readonly GameEvent[]) => {
    if (destroyed) return
    for (const event of events) {
      if (event.type === 'ripeCaught') {
        addCatchParticles(event.x, event.y)
        bounceMs = BOUNCE_MS
        const bonus = event.bonusAwarded > 0
        popScore(event.x, event.y, '+' + (event.points ?? 1 + event.bonusAwarded), bonus ? '255, 236, 153' : '255, 255, 255', bonus, bonus ? 15 : 13)
        if ((GAME_CONFIG.streakMilestones as readonly number[]).includes(event.combo)) announce(event.combo + ' in a row!', '#FFD86A')
      } else if (event.type === 'goldenCaught') {
        addCatchParticles(event.x, event.y, true)
        bounceMs = BOUNCE_MS
        popScore(event.x, event.y, '+' + event.points, '255, 226, 120', true, 20)
        if ((GAME_CONFIG.streakMilestones as readonly number[]).includes(event.combo)) announce(event.combo + ' in a row!', '#FFD86A')
      } else if (event.type === 'powerUp') {
        addCatchParticles(event.x, event.y)
        bounceMs = BOUNCE_MS
        const [text, color] = POWER_UP_BANNERS[event.kind]
        announce(text, color)
      } else if (event.type === 'milestone') {
        announce(event.score.toLocaleString('en-IN') + ' points!', '#FFD86A')
      } else if (event.type === 'lifeRestored') {
        // A milestone's banner gains a second line; the heart already announced itself.
        if (event.source === 'milestone' && banner) banner.sub = '+1 life'
      } else if (event.type === 'phaseChanged') {
        const text = PHASE_BANNERS[event.phase]
        if (text) announce(text)
      } else if (event.type === 'rottenCaught') {
        shakeRemainingMs = reducedEffects ? 0 : SHAKE_DURATION_MS
        popScore(event.x, event.y, 'Rotten!', '255, 150, 120', false, 13)
      } else if (event.type === 'ripeMissed') {
        dangerAgeMs = 0
        dangerX = event.x
      }
    }
  }

  const updateEffects = (frameMs: number) => {
    const elapsedMs = normalizeFrameMs(frameMs)
    const motionMs = Math.min(50, elapsedMs)
    const motionSeconds = motionMs / 1000
    shakeRemainingMs = advanceEffectDuration(shakeRemainingMs, elapsedMs)
    clockMs += elapsedMs
    bounceMs = Math.max(0, bounceMs - elapsedMs)
    if (banner) {
      banner.ageMs += elapsedMs
      if (banner.ageMs >= BANNER_MS) banner = null
    }
    dangerAgeMs = Math.min(DANGER_PULSE_MS, dangerAgeMs + elapsedMs)
    for (const particle of particles) {
      if (!particle.active) continue
      particle.ageMs += elapsedMs
      if (particle.ageMs >= particle.durationMs) {
        particle.active = false
        continue
      }
      particle.vy += 145 * motionSeconds
      particle.x += particle.vx * motionSeconds
      particle.y += particle.vy * motionSeconds
    }
    for (const burst of bursts) {
      if (!burst.active) continue
      burst.ageMs += elapsedMs
      if (burst.ageMs >= burst.durationMs) burst.active = false
    }
  }

  const drawEffects = () => {
    let renderedParticles = 0
    for (const particle of particles) {
      if (!particle.active) continue
      if (reducedEffects && renderedParticles >= 2) continue
      const life = 1 - particle.ageMs / particle.durationMs
      context.globalAlpha = clamp(life * 1.35, 0, 1)
      context.fillStyle = particle.color
      context.beginPath()
      context.arc(particle.x, particle.y, particle.radius * (0.75 + life * 0.45), 0, TAU)
      context.fill()
      renderedParticles += 1
    }
    context.globalAlpha = 1

    if (reducedEffects) return

    for (const burst of bursts) {
      if (!burst.active) continue
      const progress = burst.ageMs / burst.durationMs
      // In fast, hold, then fade over the last 40%.
      const opacity = Math.min(1, progress / 0.12) * (1 - Math.max(0, progress - 0.6) / 0.4)
      if (burst.ring) {
        context.strokeStyle = 'rgba(' + burst.color + ', ' + opacity * 0.9 + ')'
        context.lineWidth = 2.5 - progress
        context.beginPath()
        context.arc(burst.x, burst.y, 17 + progress * 25, 0, TAU)
        context.stroke()
      }
      const rise = 22 + (1 - Math.pow(1 - progress, 3)) * 26
      context.font = '800 ' + burst.size + 'px ui-sans-serif, system-ui, sans-serif'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.lineWidth = 3
      context.strokeStyle = 'rgba(46, 18, 5, ' + opacity * 0.55 + ')'
      context.strokeText(burst.text, burst.x, burst.y - rise)
      context.fillStyle = 'rgba(' + burst.color + ', ' + opacity + ')'
      context.fillText(burst.text, burst.x, burst.y - rise)
    }
  }

  const drawBanner = () => {
    if (!banner) return
    const progress = banner.ageMs / BANNER_MS
    const fadeIn = Math.min(1, progress / 0.12)
    const fadeOut = 1 - Math.max(0, progress - 0.7) / 0.3
    // Overshoots slightly on the way in; holds still when effects are reduced.
    const scale = reducedEffects ? 1 : 0.8 + 0.2 * fadeIn + 0.06 * Math.sin(Math.min(1, progress / 0.2) * Math.PI)
    context.save()
    context.translate(GAME_CONFIG.width / 2, 236)
    context.scale(scale, scale)
    context.globalAlpha = fadeIn * fadeOut
    context.font = '800 30px ui-serif, Georgia, serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.lineJoin = 'round'
    context.lineWidth = 6
    context.strokeStyle = 'rgba(46, 18, 5, 0.65)'
    context.strokeText(banner.text, 0, 0)
    context.fillStyle = banner.color
    context.fillText(banner.text, 0, 0)
    if (banner.sub) {
      context.font = '800 18px ui-serif, Georgia, serif'
      context.lineWidth = 5
      context.strokeText(banner.sub, 0, 30)
      context.fillStyle = '#FFB3B3'
      context.fillText(banner.sub, 0, 30)
    }
    context.restore()
    context.globalAlpha = 1
  }

  const resize = (cssWidth: number, cssHeight: number, devicePixelRatio: number) => {
    if (destroyed) return
    const safeWidth = Math.max(1, cssWidth)
    const safeHeight = Math.max(1, cssHeight)
    const backingScale = getBackingScale(devicePixelRatio)
    canvas.style.width = `${safeWidth}px`
    canvas.style.height = `${safeHeight}px`
    canvas.width = Math.max(1, Math.round(safeWidth * backingScale))
    canvas.height = Math.max(1, Math.round(safeHeight * backingScale))
  }

  const setPointerX = (logicalX: number | null) => {
    if (destroyed) return
    pointerX = logicalX !== null && Number.isFinite(logicalX) ? logicalX : null
  }

  const render = (snapshot: GameSnapshot, settings: GameSettings, frameMs: number) => {
    if (destroyed) return
    quality.observe(frameMs)
    renderedQuality = quality.current()
    reducedEffects = settings.reducedEffects
    updateEffects(frameMs)

    parallaxX = getNextParallaxX(parallaxX, pointerX, renderedQuality, reducedEffects)

    const scaleX = canvas.width / GAME_CONFIG.width
    const scaleY = canvas.height / GAME_CONFIG.height
    context.setTransform(scaleX, 0, 0, scaleY, 0, 0)
    context.clearRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height)

    const shakeStrength = !reducedEffects && shakeRemainingMs > 0
      ? 5 * (shakeRemainingMs / SHAKE_DURATION_MS)
      : 0
    const shakeX = shakeStrength ? (Math.random() * 2 - 1) * shakeStrength : 0
    const shakeY = shakeStrength ? (Math.random() * 2 - 1) * shakeStrength : 0
    context.save()
    context.translate(shakeX, shakeY)
    drawBackground(context, parallaxX, renderedQuality)
    drawDangerPulse(context, dangerAgeMs, dangerX)
    for (const item of snapshot.items) {
      if (item.kind === 'ripe') drawRipeFruit(context, item.x, item.y, item.rotation)
      else if (item.kind === 'golden') drawGoldenFruit(context, item.x, item.y, item.rotation, clockMs)
      else if (item.kind === 'bigBasket') drawBigBasketPowerUp(context, item.x, item.y, clockMs)
      else if (item.kind === 'slowFall') drawSlowFallToken(context, item.x, item.y, clockMs)
      else if (item.kind === 'doubleHarvest') drawDoubleHarvestToken(context, item.x, item.y, clockMs)
      else if (item.kind === 'extraLife') drawHeartToken(context, item.x, item.y, clockMs)
      else drawRottenFruit(context, item.x, item.y, item.rotation)
    }
    drawBasket(context, snapshot.basketX, snapshot.basketVelocity, {
      widthScale: snapshot.bigBasketMs > 0 ? GAME_CONFIG.bigBasketScale : 1,
      bounce: reducedEffects ? 0 : Math.sin((bounceMs / BOUNCE_MS) * Math.PI),
      glow: snapshot.combo >= 20 ? 2 : snapshot.combo >= 10 ? 1 : 0,
      bars: timerBars(snapshot),
      golden: snapshot.doubleHarvestMs > 0,
    })
    drawEffects()
    context.restore()

    // One more mistake ends the game: say so at the edges.
    const oneMistakeLeft =
      snapshot.misses >= GAME_CONFIG.maxMisses - 1 || snapshot.badCatches >= GAME_CONFIG.maxBadCatches - 1
    if (oneMistakeLeft && !snapshot.gameOver && !reducedEffects) drawLastChance(context, clockMs)
    drawBanner()
  }

  const clear = () => {
    if (destroyed) return
    particles.length = 0
    bursts.length = 0
    shakeRemainingMs = 0
    dangerAgeMs = DANGER_PULSE_MS
    dangerX = GAME_CONFIG.width / 2
    clockMs = 0
    bounceMs = 0
    banner = null
    pointerX = null
    parallaxX = 0
    reducedEffects = false
    renderedQuality = 'high'
    quality = createQualityController()
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.clearRect(0, 0, canvas.width, canvas.height)
  }

  const destroy = () => {
    if (destroyed) return
    clear()
    destroyed = true
  }

  return { resize, setPointerX, emit, announce, render, clear, destroy }
}
