export { parseCode } from './parser/index'
export type { CodeElement, CodeElementType, CodeStats, ParseResult } from './parser/index'

export { mapCodeToMusic } from './mapper/index'
export type { MusicalNote, MusicalSection, MusicResult, MusicalScale, MusicStyle } from './mapper/index'

export { getSynthesizer, disposeSynthesizer } from './audio/index'
export type { PlaybackState, SynthesizerCallbacks } from './audio/index'
