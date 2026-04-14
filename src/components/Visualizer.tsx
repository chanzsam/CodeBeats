import { useEffect, useRef, useCallback } from 'react'
import type { MusicResult } from '../core/mapper/index'

interface VisualizerProps {
  music: MusicResult | null
  isPlaying: boolean
  activeNoteIndex: number
  activeSectionIndex: number
}

export default function Visualizer({ music, isPlaying, activeNoteIndex, activeSectionIndex }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const particlesRef = useRef<Array<{
    x: number
    y: number
    vx: number
    vy: number
    life: number
    maxLife: number
    color: string
    size: number
  }>>([])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const w = rect.width
    const h = rect.height

    ctx.fillStyle = '#0a0a1a'
    ctx.fillRect(0, 0, w, h)

    const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.05)')
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, w, h)

    if (!music) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
      ctx.font = '16px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('Paste your code and hit Play to visualize', w / 2, h / 2)
      return
    }

    const barCount = 64
    const barWidth = (w - 40) / barCount
    const barGap = 2

    for (let i = 0; i < barCount; i++) {
      const sectionIdx = Math.floor((i / barCount) * music.sections.length)
      const section = music.sections[sectionIdx]
      const isActive = sectionIdx === activeSectionIndex && isPlaying

      let barHeight: number
      if (isPlaying) {
        const noteInBar = music.notes[i * Math.floor(music.notes.length / barCount)]
        if (noteInBar) {
          barHeight = ((noteInBar.pitch % 24) / 24) * h * 0.6 + h * 0.1
        } else {
          barHeight = h * 0.05
        }
        if (isActive) {
          barHeight *= 1.2 + Math.sin(Date.now() * 0.01 + i * 0.5) * 0.3
        }
      } else {
        barHeight = ((i * 7 + 13) % 24) / 24 * h * 0.3 + h * 0.05
      }

      const x = 20 + i * (barWidth + barGap)
      const y = h - barHeight - 20

      const barGradient = ctx.createLinearGradient(x, y, x, h - 20)
      if (isActive) {
        barGradient.addColorStop(0, '#ec4899')
        barGradient.addColorStop(0.5, '#8b5cf6')
        barGradient.addColorStop(1, '#6366f1')
      } else {
        barGradient.addColorStop(0, '#6366f1')
        barGradient.addColorStop(1, '#3b82f6')
      }

      ctx.fillStyle = barGradient
      ctx.beginPath()
      const radius = Math.min(barWidth / 2, 3)
      ctx.moveTo(x + radius, y)
      ctx.lineTo(x + barWidth - radius, y)
      ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius)
      ctx.lineTo(x + barWidth, h - 20)
      ctx.lineTo(x, h - 20)
      ctx.lineTo(x, y + radius)
      ctx.quadraticCurveTo(x, y, x + radius, y)
      ctx.fill()

      if (isActive) {
        ctx.shadowColor = '#8b5cf6'
        ctx.shadowBlur = 15
        ctx.fillStyle = 'rgba(139, 92, 246, 0.3)'
        ctx.fillRect(x, y, barWidth, barHeight)
        ctx.shadowBlur = 0
      }
    }

    if (isPlaying && activeSectionIndex < music.sections.length) {
      const section = music.sections[activeSectionIndex]
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
      ctx.font = 'bold 14px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(section.label, w / 2, 30)

      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.font = '12px monospace'
      ctx.fillText(`${music.key} ${music.scale} | ${music.bpm} BPM | ${music.style}`, w / 2, 50)
    }

    if (isPlaying) {
      for (let i = 0; i < 2; i++) {
        const px = Math.random() * w
        const py = h - 40 - Math.random() * h * 0.5
        particlesRef.current.push({
          x: px,
          y: py,
          vx: (Math.random() - 0.5) * 2,
          vy: -Math.random() * 3 - 1,
          life: 1,
          maxLife: 1,
          color: Math.random() > 0.5 ? '#ec4899' : '#8b5cf6',
          size: Math.random() * 3 + 1,
        })
      }
    }

    particlesRef.current = particlesRef.current.filter(p => p.life > 0)
    for (const p of particlesRef.current) {
      p.x += p.vx
      p.y += p.vy
      p.life -= 0.02
      p.vy *= 0.98

      ctx.globalAlpha = p.life
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    if (isPlaying) {
      const waveY = h * 0.3
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      for (let i = 0; i < w; i++) {
        const y = waveY + Math.sin(i * 0.02 + Date.now() * 0.003) * 20 * (isPlaying ? 1 : 0.2)
        if (i === 0) ctx.moveTo(i, y)
        else ctx.lineTo(i, y)
      }
      ctx.stroke()
    }

    animationRef.current = requestAnimationFrame(draw)
  }, [music, isPlaying, activeNoteIndex, activeSectionIndex])

  useEffect(() => {
    animationRef.current = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(animationRef.current)
    }
  }, [draw])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        borderRadius: '12px',
      }}
    />
  )
}
