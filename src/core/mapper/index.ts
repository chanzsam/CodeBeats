import type { CodeElement, CodeElementType, CodeStats, ParseResult } from '../parser/index'

export type MusicalScale =
  | 'major'
  | 'minor'
  | 'pentatonic'
  | 'blues'
  | 'dorian'
  | 'mixolydian'
  | 'japanese'

export type MusicStyle =
  | 'piano'
  | 'electronic'
  | 'classical'
  | 'jazz'
  | 'ambient'
  | 'chiptune'
  | 'lofi'

export interface MusicalNote {
  pitch: number
  duration: string
  velocity: number
  time: number
  instrument: string
  effect?: string
}

export interface MusicalSection {
  element: CodeElement
  notes: MusicalNote[]
  label: string
}

export interface MusicResult {
  sections: MusicalSection[]
  bpm: number
  key: string
  scale: MusicalScale
  style: MusicStyle
  totalDuration: number
  notes: MusicalNote[]
}

const SCALES: Record<MusicalScale, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  japanese: [0, 1, 5, 7, 8],
}

const KEY_MAP: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3,
  E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8,
  Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
}

const STYLE_CONFIG: Record<MusicStyle, {
  bpm: number
  defaultInstrument: string
  bassInstrument: string
  drumInstrument: string
  padInstrument: string
  swingFactor: number
  reverbMix: number
}> = {
  piano: { bpm: 72, defaultInstrument: 'GrandPiano', bassInstrument: 'GrandPianoBass', drumInstrument: 'SoftMallet', padInstrument: 'GrandPianoPad', swingFactor: 0, reverbMix: 0.7 },
  electronic: { bpm: 128, defaultInstrument: 'Synth', bassInstrument: 'SynthBass', drumInstrument: 'Drums', padInstrument: 'Pad', swingFactor: 0, reverbMix: 0.3 },
  classical: { bpm: 90, defaultInstrument: 'Piano', bassInstrument: 'Cello', drumInstrument: 'Timpani', padInstrument: 'Strings', swingFactor: 0, reverbMix: 0.5 },
  jazz: { bpm: 110, defaultInstrument: 'Piano', bassInstrument: 'Bass', drumInstrument: 'Brushes', padInstrument: 'Vibraphone', swingFactor: 0.3, reverbMix: 0.4 },
  ambient: { bpm: 70, defaultInstrument: 'Pad', bassInstrument: 'SubBass', drumInstrument: 'Percussion', padInstrument: 'Atmosphere', swingFactor: 0, reverbMix: 0.8 },
  chiptune: { bpm: 140, defaultInstrument: 'Square', bassInstrument: 'SquareBass', drumInstrument: 'Noise', padInstrument: 'Triangle', swingFactor: 0, reverbMix: 0.1 },
  lofi: { bpm: 85, defaultInstrument: 'EPiano', bassInstrument: 'Bass', drumInstrument: 'LoFiDrums', padInstrument: 'VinylPad', swingFactor: 0.15, reverbMix: 0.6 },
}

function selectKeyAndScale(stats: CodeStats, language: string, complexity: number): { key: string; scale: MusicalScale } {
  const keys = ['C', 'D', 'E', 'F', 'G', 'A', 'Bb']
  let key: string
  let scale: MusicalScale

  if (stats.conditionals > stats.loops) {
    scale = 'minor'
  } else if (stats.functions > 5) {
    scale = 'major'
  } else {
    scale = 'pentatonic'
  }

  const langKeyMap: Record<string, string> = {
    python: 'D',
    javascript: 'E',
    typescript: 'F',
    rust: 'C',
    go: 'G',
    c: 'A',
  }
  key = langKeyMap[language] || 'C'

  if (stats.depth > 4) scale = 'blues'
  if (complexity > 30) scale = 'dorian'
  if (language === 'python') scale = 'pentatonic'

  return { key, scale }
}

function selectBpm(stats: CodeStats, style: MusicStyle): number {
  const baseBpm = STYLE_CONFIG[style].bpm
  const densityFactor = Math.min(stats.density * 10, 30)
  const depthFactor = stats.depth * 3
  return Math.round(baseBpm + densityFactor - depthFactor)
}

function getScaleNote(scale: MusicalScale, root: number, degree: number, octave: number): number {
  const intervals = SCALES[scale]
  const octaveOffset = Math.floor(degree / intervals.length)
  const scaleIndex = ((degree % intervals.length) + intervals.length) % intervals.length
  return root + octave * 12 + intervals[scaleIndex] + octaveOffset * 12
}

function nameToSeed(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash)
}

type ConfigType = ReturnType<typeof selectKeyAndScale>

function mapFunction(element: CodeElement, config: ConfigType, style: MusicStyle, startTime: number): MusicalNote[] {
  const styleCfg = STYLE_CONFIG[style]
  const root = KEY_MAP[config.key]
  const nameSeed = element.name ? nameToSeed(element.name) % 7 : 0
  const notes: MusicalNote[] = []

  const baseOctave = 4 + Math.min(element.depth, 3)
  const isAsync = element.properties?.async
  const isExported = element.properties?.exported

  if (style === 'piano') {
    const melodyLength = Math.max(8, Math.min(16, (element.name?.length || 4) * 2))
    const pianoDurations = ['4n', '8n', '8n', '4n', '8n', '8n', '2n', '4n', '8n', '8n', '4n', '8n', '8n', '2n', '4n', '1n']
    const pianoIntervals = [0, 2, 4, 5, 4, 2, 0, -1, 0, 2, 4, 7, 5, 4, 2, 0]

    for (let i = 0; i < melodyLength; i++) {
      const interval = pianoIntervals[i % pianoIntervals.length]
      const degree = ((nameSeed + interval) % 7 + 7) % 7
      const octaveShift = interval < 0 ? -1 : (interval > 5 ? 1 : 0)
      const pitch = getScaleNote(config.scale, root, degree, baseOctave + octaveShift)
      const duration = pianoDurations[i % pianoDurations.length]
      const velocity = i === 0 ? 0.85
        : i === melodyLength - 1 ? 0.9
        : 0.55 + (i % 3 === 0 ? 0.15 : 0)

      notes.push({
        pitch,
        duration,
        velocity,
        time: startTime + i * 0.25,
        instrument: styleCfg.defaultInstrument,
        effect: isAsync ? 'delay' : undefined,
      })

      if (i % 4 === 3 && i < melodyLength - 1) {
        const chordDeg = [0, 2, 4]
        for (const d of chordDeg) {
          notes.push({
            pitch: getScaleNote(config.scale, root, (nameSeed + d) % 7, baseOctave - 1),
            duration: '2n',
            velocity: 0.25,
            time: startTime + i * 0.25,
            instrument: styleCfg.padInstrument,
          })
        }
      }
    }
  } else {
    const melodyLength = Math.max(6, Math.min(12, (element.name?.length || 4) * 2))
    const durations = ['16n', '8n', '16n', '8n', '16n', '4n', '16n', '8n', '16n', '8n', '16n', '2n']

    for (let i = 0; i < melodyLength; i++) {
      const degree = (nameSeed + i * (i % 2 === 0 ? 2 : 3)) % 7
      const pitch = getScaleNote(config.scale, root, degree, baseOctave)
      const duration = durations[i % durations.length]
      const velocity = isExported
        ? (i === 0 ? 1.0 : 0.8)
        : (i === 0 ? 0.9 : 0.65 + (i % 3) * 0.05)

      notes.push({
        pitch,
        duration,
        velocity,
        time: startTime + i * 0.125,
        instrument: styleCfg.defaultInstrument,
        effect: isAsync ? 'delay' : undefined,
      })

      if (i % 4 === 3 && i < melodyLength - 1) {
        const passingDegree = (nameSeed + i * 2 + 1) % 7
        notes.push({
          pitch: getScaleNote(config.scale, root, passingDegree, baseOctave),
          duration: '32n',
          velocity: 0.45,
          time: startTime + i * 0.125 + 0.0625,
          instrument: styleCfg.defaultInstrument,
        })
      }
    }
  }

  return notes
}

function mapLoop(element: CodeElement, config: ConfigType, style: MusicStyle, startTime: number): MusicalNote[] {
  const styleCfg = STYLE_CONFIG[style]
  const root = KEY_MAP[config.key]
  const notes: MusicalNote[] = []

  const isNested = element.depth > 1

  if (style === 'piano') {
    const arpeggioPatterns = [
      [0, 2, 4, 7, 4, 2],
      [0, 3, 5, 7, 5, 3],
      [0, 1, 4, 6, 4, 1],
    ]
    const pattern = arpeggioPatterns[nameToSeed(element.name || 'loop') % arpeggioPatterns.length]
    const repeats = isNested ? 3 : 2

    for (let r = 0; r < repeats; r++) {
      for (let i = 0; i < pattern.length; i++) {
        const degree = pattern[i]
        const octave = degree >= 5 ? 5 : 4
        const pitch = getScaleNote(config.scale, root, degree % 7, octave)
        const time = startTime + (r * pattern.length + i) * 0.2
        const velocity = i === 0 ? 0.75 : (i === pattern.length - 1 ? 0.65 : 0.5)

        notes.push({
          pitch,
          duration: i === 0 ? '4n' : '8n',
          velocity,
          time,
          instrument: styleCfg.defaultInstrument,
        })
      }
    }

    notes.push({
      pitch: getScaleNote(config.scale, root, 0, 3),
      duration: '2n',
      velocity: 0.5,
      time: startTime,
      instrument: styleCfg.bassInstrument,
    })

    if (isNested) {
      const chordDegs = [0, 2, 4]
      for (const d of chordDegs) {
        notes.push({
          pitch: getScaleNote(config.scale, root, d, 3),
          duration: '1n',
          velocity: 0.2,
          time: startTime,
          instrument: styleCfg.padInstrument,
        })
      }
    }
  } else {
    const beats = 8

    for (let i = 0; i < beats; i++) {
      const time = startTime + i * 0.125

      notes.push({
        pitch: getScaleNote(config.scale, root, 0, 2),
        duration: '16n',
        velocity: i === 0 || i === 4 ? 0.95 : 0.6,
        time,
        instrument: styleCfg.drumInstrument,
      })

      if (i % 2 === 0) {
        notes.push({
          pitch: getScaleNote(config.scale, root, 2, 3),
          duration: '8n',
          velocity: 0.5,
          time: time + 0.0625,
          instrument: styleCfg.drumInstrument,
        })
      }

      if (i % 2 === 1) {
        notes.push({
          pitch: getScaleNote(config.scale, root, 5, 4),
          duration: '16n',
          velocity: 0.55,
          time: time + 0.03125,
          instrument: styleCfg.drumInstrument,
        })
      }

      if (isNested) {
        notes.push({
          pitch: getScaleNote(config.scale, root, 4, 4),
          duration: '16n',
          velocity: 0.7,
          time: time + 0.0625,
          instrument: styleCfg.drumInstrument,
        })

        if (i % 4 === 2) {
          notes.push({
            pitch: getScaleNote(config.scale, root, 6, 3),
            duration: '8n',
            velocity: 0.8,
            time,
            instrument: styleCfg.drumInstrument,
          })
        }
      }

      if (i === 6) {
        notes.push({
          pitch: getScaleNote(config.scale, root, 1, 2),
          duration: '4n',
          velocity: 0.85,
          time,
          instrument: styleCfg.bassInstrument,
        })
      }
    }
  }

  return notes
}

function mapConditional(element: CodeElement, config: ReturnType<typeof selectKeyAndScale>, style: MusicStyle, startTime: number): MusicalNote[] {
  const styleCfg = STYLE_CONFIG[style]
  const root = KEY_MAP[config.key]
  const notes: MusicalNote[] = []

  const isElse = element.name === 'else' || element.name === 'elif'

  if (style === 'piano') {
    const chordDegrees = isElse ? [0, 2, 4] : [0, 3, 5]
    for (let i = 0; i < chordDegrees.length; i++) {
      const deg = chordDegrees[i]
      notes.push({
        pitch: getScaleNote(config.scale, root, deg, 3),
        duration: '2n',
        velocity: 0.45,
        time: startTime + i * 0.15,
        instrument: styleCfg.padInstrument,
      })
    }

    const melodyDegrees = isElse ? [4, 5, 7, 5] : [1, 3, 5, 3]
    for (let i = 0; i < melodyDegrees.length; i++) {
      notes.push({
        pitch: getScaleNote(config.scale, root, melodyDegrees[i] % 7, 5),
        duration: i === melodyDegrees.length - 1 ? '4n' : '8n',
        velocity: 0.6 + i * 0.05,
        time: startTime + i * 0.2,
        instrument: styleCfg.defaultInstrument,
      })
    }
  } else {
    const chordDegrees = isElse ? [0, 2, 4] : [0, 3, 5]

    for (const deg of chordDegrees) {
      const pitch = getScaleNote(config.scale, root, deg, 3)
      notes.push({
        pitch,
        duration: '2n',
        velocity: 0.6,
        time: startTime,
        instrument: styleCfg.padInstrument,
      })
    }

    const melodyDegree = isElse ? 4 : 1
    notes.push({
      pitch: getScaleNote(config.scale, root, melodyDegree, 5),
      duration: '8n',
      velocity: 0.7,
      time: startTime,
      instrument: styleCfg.defaultInstrument,
    })
    notes.push({
      pitch: getScaleNote(config.scale, root, melodyDegree + 2, 5),
      duration: '8n',
      velocity: 0.6,
      time: startTime + 0.125,
      instrument: styleCfg.defaultInstrument,
    })
    notes.push({
      pitch: getScaleNote(config.scale, root, melodyDegree + 4, 5),
      duration: '4n',
      velocity: 0.75,
      time: startTime + 0.25,
      instrument: styleCfg.defaultInstrument,
    })
  }

  return notes
}

function mapVariable(element: CodeElement, config: ReturnType<typeof selectKeyAndScale>, style: MusicStyle, startTime: number): MusicalNote[] {
  const styleCfg = STYLE_CONFIG[style]
  const root = KEY_MAP[config.key]
  const notes: MusicalNote[] = []

  const nameSeed = element.name ? nameToSeed(element.name) % 5 : 0

  if (style === 'piano') {
    notes.push({
      pitch: getScaleNote(config.scale, root, nameSeed, 3),
      duration: '2n',
      velocity: 0.45,
      time: startTime,
      instrument: styleCfg.bassInstrument,
    })
    notes.push({
      pitch: getScaleNote(config.scale, root, nameSeed, 5),
      duration: '4n',
      velocity: 0.5,
      time: startTime,
      instrument: styleCfg.defaultInstrument,
    })
    notes.push({
      pitch: getScaleNote(config.scale, root, nameSeed + 2, 5),
      duration: '4n',
      velocity: 0.45,
      time: startTime + 0.25,
      instrument: styleCfg.defaultInstrument,
    })
    notes.push({
      pitch: getScaleNote(config.scale, root, nameSeed + 4, 5),
      duration: '2n',
      velocity: 0.55,
      time: startTime + 0.5,
      instrument: styleCfg.defaultInstrument,
    })
  } else {
    const pitch = getScaleNote(config.scale, root, nameSeed, 2)

    notes.push({
      pitch,
      duration: '4n',
      velocity: 0.55,
      time: startTime,
      instrument: styleCfg.bassInstrument,
    })

    notes.push({
      pitch: getScaleNote(config.scale, root, nameSeed + 2, 2),
      duration: '8n',
      velocity: 0.4,
      time: startTime + 0.25,
      instrument: styleCfg.bassInstrument,
    })

    notes.push({
      pitch: getScaleNote(config.scale, root, nameSeed, 2),
      duration: '8n',
      velocity: 0.45,
      time: startTime + 0.375,
      instrument: styleCfg.bassInstrument,
    })
  }

  return notes
}

function mapImport(element: CodeElement, config: ReturnType<typeof selectKeyAndScale>, style: MusicStyle, startTime: number): MusicalNote[] {
  const styleCfg = STYLE_CONFIG[style]
  const root = KEY_MAP[config.key]
  const notes: MusicalNote[] = []

  for (let i = 0; i < 3; i++) {
    const pitch = getScaleNote(config.scale, root, i, 5)
    notes.push({
      pitch,
      duration: '8n',
      velocity: 0.3 + i * 0.1,
      time: startTime + i * 0.15,
      instrument: styleCfg.padInstrument,
      effect: 'reverb',
    })
  }

  return notes
}

function mapComment(element: CodeElement, config: ReturnType<typeof selectKeyAndScale>, style: MusicStyle, startTime: number): MusicalNote[] {
  const styleCfg = STYLE_CONFIG[style]
  const root = KEY_MAP[config.key]
  const notes: MusicalNote[] = []

  const pitch = getScaleNote(config.scale, root, 6, 4)
  notes.push({
    pitch,
    duration: '1n',
    velocity: 0.2,
    time: startTime,
    instrument: styleCfg.padInstrument,
    effect: 'reverb',
  })

  return notes
}

function mapReturn(element: CodeElement, config: ReturnType<typeof selectKeyAndScale>, style: MusicStyle, startTime: number): MusicalNote[] {
  const styleCfg = STYLE_CONFIG[style]
  const root = KEY_MAP[config.key]
  const notes: MusicalNote[] = []

  for (let i = 0; i < 3; i++) {
    const pitch = getScaleNote(config.scale, root, 6 - i * 2, 4 - Math.floor(i / 2))
    notes.push({
      pitch,
      duration: '8n',
      velocity: 0.7 - i * 0.15,
      time: startTime + i * 0.2,
      instrument: styleCfg.defaultInstrument,
      effect: 'fadeout',
    })
  }

  return notes
}

function mapClass(element: CodeElement, config: ReturnType<typeof selectKeyAndScale>, style: MusicStyle, startTime: number): MusicalNote[] {
  const styleCfg = STYLE_CONFIG[style]
  const root = KEY_MAP[config.key]
  const notes: MusicalNote[] = []

  const chordDegrees = [0, 2, 4, 6]
  for (const deg of chordDegrees) {
    const pitch = getScaleNote(config.scale, root, deg, 3)
    notes.push({
      pitch,
      duration: '1n',
      velocity: 0.6,
      time: startTime,
      instrument: styleCfg.padInstrument,
    })
  }

  const melodyPitch = getScaleNote(config.scale, root, 0, 5)
  notes.push({
    pitch: melodyPitch,
    duration: '2n',
    velocity: 0.8,
    time: startTime + 0.5,
    instrument: styleCfg.defaultInstrument,
  })

  return notes
}

function mapTryCatch(element: CodeElement, config: ReturnType<typeof selectKeyAndScale>, style: MusicStyle, startTime: number): MusicalNote[] {
  const styleCfg = STYLE_CONFIG[style]
  const root = KEY_MAP[config.key]
  const notes: MusicalNote[] = []

  const isCatch = element.type === 'trycatch' && /catch|except/.test(element.name || '')
  const pitch = isCatch
    ? root + 1 + Math.random() * 2
    : getScaleNote(config.scale, root, 5, 4)

  notes.push({
    pitch: Math.round(pitch),
    duration: '4n',
    velocity: isCatch ? 0.9 : 0.5,
    time: startTime,
    instrument: styleCfg.defaultInstrument,
    effect: isCatch ? 'distortion' : undefined,
  })

  return notes
}

function mapDefault(element: CodeElement, config: ReturnType<typeof selectKeyAndScale>, style: MusicStyle, startTime: number): MusicalNote[] {
  const styleCfg = STYLE_CONFIG[style]
  const root = KEY_MAP[config.key]
  const nameSeed = element.name ? nameToSeed(element.name) % 7 : Math.floor(Math.random() * 7)
  const pitch = getScaleNote(config.scale, root, nameSeed, 3 + Math.min(element.depth, 2))

  return [{
    pitch,
    duration: '8n',
    velocity: 0.4,
    time: startTime,
    instrument: styleCfg.defaultInstrument,
  }]
}

const MAPPER_MAP: Record<CodeElementType, (el: CodeElement, cfg: ConfigType, style: MusicStyle, t: number) => MusicalNote[]> = {
  function: mapFunction,
  class: mapClass,
  loop: mapLoop,
  conditional: mapConditional,
  variable: mapVariable,
  import: mapImport,
  comment: mapComment,
  return: mapReturn,
  assignment: mapDefault,
  operator: mapDefault,
  string: mapDefault,
  number: mapDefault,
  decorator: mapImport,
  trycatch: mapTryCatch,
}

export function mapCodeToMusic(parseResult: ParseResult, style: MusicStyle = 'electronic'): MusicResult {
  const complexity = parseResult.stats.depth * parseResult.stats.functions + parseResult.stats.conditionals + parseResult.stats.loops
  const config = selectKeyAndScale(parseResult.stats, parseResult.language, complexity)
  const bpm = selectBpm(parseResult.stats, style)
  const beatDuration = 60 / bpm

  const sections: MusicalSection[] = []
  let currentTime = 0

  for (const element of parseResult.elements) {
    const mapper = MAPPER_MAP[element.type] || mapDefault
    const notes = mapper(element, config, style, currentTime)

    const LABELS: Record<CodeElementType, string> = {
      function: '🎵 Function',
      class: '🏛️ Class',
      loop: '🔄 Loop',
      conditional: '🔀 Conditional',
      variable: '📦 Variable',
      import: '📥 Import',
      comment: '💬 Comment',
      return: '↩️ Return',
      assignment: '📝 Assignment',
      operator: '⚡ Operator',
      string: '🔤 String',
      number: '🔢 Number',
      decorator: '✨ Decorator',
      trycatch: '🛡️ Try/Catch',
    }

    sections.push({
      element,
      notes,
      label: `${LABELS[element.type]} ${element.name || ''}`.trim(),
    })

    if (notes.length > 0) {
      const maxNoteTime = Math.max(...notes.map(n => n.time))
      let gap: number
      if (style === 'piano') {
        gap = element.type === 'comment' ? beatDuration * 0.2 : beatDuration * 0.5
      } else {
        gap = element.type === 'comment' ? beatDuration * 0.15 : beatDuration * 0.3
      }
      currentTime = maxNoteTime + gap
    } else {
      currentTime += style === 'piano' ? beatDuration * 0.2 : beatDuration * 0.15
    }
  }

  const allNotes: MusicalNote[] = sections.flatMap(s => s.notes)
  const totalDuration = allNotes.length > 0
    ? Math.max(...allNotes.map(n => n.time)) + 1
    : 0

  return {
    sections,
    bpm,
    key: config.key,
    scale: config.scale,
    style,
    totalDuration,
    notes: allNotes,
  }
}
