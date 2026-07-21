import { GAME_CONFIG } from './config'
import type { GameEvent, GameSettings, GameSnapshot, QualityLevel } from './types'

const MAX_PARTICLES = 96
const MAX_BURSTS = 12
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
}

export interface QualityController {
  observe(frameMs: number): void
  current(): QualityLevel
}

export interface GameRenderer {
  resize(cssWidth: number, cssHeight: number, devicePixelRatio: number): void
  emit(events: readonly GameEvent[]): void
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

function drawBasket(context: CanvasRenderingContext2D, x: number, velocity: number) {
  context.save()
  context.translate(x, GAME_CONFIG.basketY + 3)
  context.rotate(clamp(velocity / 900, -0.12, 0.12))

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

export function createRenderer(canvas: HTMLCanvasElement): GameRenderer {
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) throw new Error('Canvas 2D rendering is unavailable')

  let quality = createQualityController()
  let renderedQuality: QualityLevel = 'high'
  let reducedEffects = false
  let parallaxX = 0
  let shakeRemainingMs = 0
  let dangerAgeMs = DANGER_PULSE_MS
  let dangerX = GAME_CONFIG.width / 2
  let destroyed = false
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
    const burst: ScoreBurst = { active: false, x: 0, y: 0, ageMs: 0, durationMs: 0 }
    bursts.push(burst)
    return burst
  }

  const addCatchParticles = (x: number, y: number) => {
    const count = renderedQuality === 'high' ? 10 : 4
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
      particle.color = index % 3 === 0 ? '#F7D46A' : index % 2 === 0 ? '#8EAD56' : '#D9964A'
    }
  }

  const emit = (events: readonly GameEvent[]) => {
    if (destroyed) return
    for (const event of events) {
      if (event.type === 'ripeCaught') {
        addCatchParticles(event.x, event.y)
        if (event.bonusAwarded > 0) {
          const burst = allocateBurst()
          if (burst) {
            burst.active = true
            burst.x = event.x
            burst.y = event.y
            burst.ageMs = 0
            burst.durationMs = 720
          }
        }
      } else if (event.type === 'rottenCaught') {
        shakeRemainingMs = reducedEffects ? 0 : SHAKE_DURATION_MS
      } else if (event.type === 'ripeMissed') {
        dangerAgeMs = 0
        dangerX = event.x
      }
    }
  }

  const updateEffects = (frameMs: number) => {
    const dtMs = clamp(Number.isFinite(frameMs) ? frameMs : 0, 0, 50)
    const dtSeconds = dtMs / 1000
    shakeRemainingMs = Math.max(0, shakeRemainingMs - dtMs)
    dangerAgeMs = Math.min(DANGER_PULSE_MS, dangerAgeMs + dtMs)
    for (const particle of particles) {
      if (!particle.active) continue
      particle.ageMs += dtMs
      if (particle.ageMs >= particle.durationMs) {
        particle.active = false
        continue
      }
      particle.vy += 145 * dtSeconds
      particle.x += particle.vx * dtSeconds
      particle.y += particle.vy * dtSeconds
    }
    for (const burst of bursts) {
      if (!burst.active) continue
      burst.ageMs += dtMs
      if (burst.ageMs >= burst.durationMs) burst.active = false
    }
  }

  const drawEffects = () => {
    for (const particle of particles) {
      if (!particle.active) continue
      const life = 1 - particle.ageMs / particle.durationMs
      context.globalAlpha = clamp(life * 1.35, 0, 1)
      context.fillStyle = particle.color
      context.beginPath()
      context.arc(particle.x, particle.y, particle.radius * (0.75 + life * 0.45), 0, TAU)
      context.fill()
    }
    context.globalAlpha = 1

    for (const burst of bursts) {
      if (!burst.active) continue
      const progress = burst.ageMs / burst.durationMs
      const opacity = Math.sin(progress * Math.PI)
      context.strokeStyle = `rgba(255, 216, 106, ${opacity * 0.9})`
      context.lineWidth = 2.5 - progress
      context.beginPath()
      context.arc(burst.x, burst.y, 17 + progress * 25, 0, TAU)
      context.stroke()
      context.fillStyle = `rgba(255, 236, 153, ${opacity})`
      context.font = '700 12px ui-sans-serif, system-ui, sans-serif'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText('+1 COMBO', burst.x, burst.y - 24 - progress * 13)
    }
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

  const render = (snapshot: GameSnapshot, settings: GameSettings, frameMs: number) => {
    if (destroyed) return
    quality.observe(frameMs)
    renderedQuality = quality.current()
    reducedEffects = settings.reducedEffects
    updateEffects(frameMs)

    const parallaxTarget = renderedQuality === 'high' && !reducedEffects
      ? clamp(((snapshot.basketX / GAME_CONFIG.width) - 0.5) * 12, -6, 6)
      : 0
    parallaxX += (parallaxTarget - parallaxX) * 0.12
    parallaxX = clamp(parallaxX, -6, 6)

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
      else drawRottenFruit(context, item.x, item.y, item.rotation)
    }
    drawBasket(context, snapshot.basketX, snapshot.basketVelocity)
    drawEffects()
    context.restore()
  }

  const clear = () => {
    particles.length = 0
    bursts.length = 0
    shakeRemainingMs = 0
    dangerAgeMs = DANGER_PULSE_MS
    dangerX = GAME_CONFIG.width / 2
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

  return { resize, emit, render, clear, destroy }
}
