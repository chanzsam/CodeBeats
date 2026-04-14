export type CodeElementType =
  | 'function'
  | 'class'
  | 'loop'
  | 'conditional'
  | 'variable'
  | 'import'
  | 'comment'
  | 'return'
  | 'assignment'
  | 'operator'
  | 'string'
  | 'number'
  | 'decorator'
  | 'trycatch'

export interface CodeElement {
  type: CodeElementType
  name?: string
  depth: number
  line: number
  lineEnd: number
  children?: CodeElement[]
  properties?: Record<string, string | number | boolean>
}

export interface ParseResult {
  language: string
  elements: CodeElement[]
  totalLines: number
  complexity: number
  stats: CodeStats
}

export interface CodeStats {
  functions: number
  classes: number
  loops: number
  conditionals: number
  variables: number
  comments: number
  imports: number
  returns: number
  depth: number
  density: number
}

interface LanguagePattern {
  function: RegExp[]
  class: RegExp[]
  loop: RegExp[]
  conditional: RegExp[]
  variable: RegExp[]
  import: RegExp[]
  comment: RegExp[]
  return: RegExp[]
  decorator: RegExp[]
  trycatch: RegExp[]
}

const PATTERNS: Record<string, LanguagePattern> = {
  javascript: {
    function: [
      /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
      /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[\w]+)\s*=>/,
      /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function/,
    ],
    class: [/^(?:export\s+)?class\s+(\w+)/],
    loop: [/^for\s*\(/, /^while\s*\(/, /^do\s*\{/, /^for\s*\.\s*\w+\s*\(/, /^\s*\.\s*forEach\s*\(/, /^\s*\.\s*map\s*\(/, /^\s*\.\s*filter\s*\(/],
    conditional: [/^if\s*\(/, /^else\s*(?:if\s*\()?/, /^switch\s*\(/, /^case\s+/, /^default:/, /^\?\s*.+\s*:/],
    variable: [/^(?:export\s+)?(?:const|let|var)\s+(\w+)/],
    import: [/^import\s+/, /^require\s*\(/],
    comment: [/^\/\//, /^\/\*/, /^\*/],
    return: [/^return\s*/],
    decorator: [/^@\w+/],
    trycatch: [/^try\s*\{/, /^catch\s*\(/, /^finally\s*\{/],
  },
  python: {
    function: [/^(?:async\s+)?def\s+(\w+)/],
    class: [/^class\s+(\w+)/],
    loop: [/^for\s+/, /^while\s+/],
    conditional: [/^if\s+/, /^elif\s+/, /^else:/],
    variable: [/^(\w+)\s*=/],
    import: [/^import\s+/, /^from\s+[\w.]+\s+import/],
    comment: [/^#/],
    return: [/^return\s*/],
    decorator: [/^@\w+/],
    trycatch: [/^try:/, /^except\s*/, /^finally:/],
  },
  rust: {
    function: [/^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/],
    class: [/^(?:pub\s+)?struct\s+(\w+)/, /^(?:pub\s+)?enum\s+(\w+)/, /^(?:pub\s+)?trait\s+(\w+)/, /^(?:pub\s+)?impl(?:<[^>]+>)?\s+(\w+)/],
    loop: [/^for\s+/, /^while\s+/, /^loop\s*\{/],
    conditional: [/^if\s+/, /^else\s+/, /^match\s+/],
    variable: [/^(?:let|let\s+mut)\s+(\w+)/],
    import: [/^use\s+/],
    comment: [/^\/\//, /^\/\*/],
    return: [/^return\s*/],
    decorator: [/^#\[.*\]/],
    trycatch: [],
  },
  go: {
    function: [/^func\s+(?:\([^)]+\)\s+)?(\w+)/],
    class: [/^type\s+(\w+)\s+struct/, /^type\s+(\w+)\s+interface/],
    loop: [/^for\s+/, /^for\s*\{/],
    conditional: [/^if\s+/, /^else\s+/, /^switch\s+/, /^case\s+/, /^default:/],
    variable: [/^(?:var|const)\s+(\w+)/, /^(\w+)\s*:=/],
    import: [/^import\s*\(/, /^import\s+"/],
    comment: [/^\/\//, /^\/\*/],
    return: [/^return\s*/],
    decorator: [],
    trycatch: [/^defer\s+/, /^panic\s*\(/, /^recover\s*\(/],
  },
  typescript: {
    function: [
      /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
      /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*:\s*(?:\([^)]*\)|[\w<>]+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[\w]+)\s*=>/,
      /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function/,
    ],
    class: [/^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/, /^(?:export\s+)?interface\s+(\w+)/, /^(?:export\s+)?type\s+(\w+)\s*=/],
    loop: [/^for\s*\(/, /^while\s*\(/, /^do\s*\{/, /^for\s*\.\s*\w+\s*\(/, /^\s*\.\s*forEach\s*\(/, /^\s*\.\s*map\s*\(/],
    conditional: [/^if\s*\(/, /^else\s*(?:if\s*\()?/, /^switch\s*\(/, /^case\s+/, /^default:/],
    variable: [/^(?:export\s+)?(?:const|let|var)\s+(\w+)/],
    import: [/^import\s+/, /^import\s*\{/],
    comment: [/^\/\//, /^\/\*/, /^\*/],
    return: [/^return\s*/],
    decorator: [/^@\w+/],
    trycatch: [/^try\s*\{/, /^catch\s*\(/, /^finally\s*\{/],
  },
}

function detectLanguage(code: string): string {
  if (/^import\s+/m.test(code) && /^func\s+/m.test(code)) return 'go'
  if (/^(?:fn|let\s+mut|pub\s+fn)/m.test(code)) return 'rust'
  if (/^def\s+/m.test(code) || /^from\s+[\w.]+\s+import/m.test(code)) return 'python'
  if (/^interface\s+/m.test(code) || /:\s*(?:string|number|boolean|void)/m.test(code)) return 'typescript'
  return 'javascript'
}

function getIndentLevel(line: string, indentSize: number = 2): number {
  const spaces = line.match(/^(\s*)/)?.[1].length || 0
  return Math.floor(spaces / indentSize)
}

function matchPatterns(line: string, patterns: RegExp[]): { matched: boolean; name?: string } {
  for (const pattern of patterns) {
    const match = line.match(pattern)
    if (match) {
      return { matched: true, name: match[1] }
    }
  }
  return { matched: false }
}

function detectIndentSize(code: string): number {
  const lines = code.split('\n')
  for (const line of lines) {
    const spaces = line.match(/^(\s+)/)?.[1]
    if (spaces && spaces.length <= 8 && spaces.length > 0) {
      return spaces.length
    }
  }
  return 2
}

export function parseCode(code: string): ParseResult {
  const language = detectLanguage(code)
  const patterns = PATTERNS[language] || PATTERNS.javascript
  const lines = code.split('\n')
  const indentSize = detectIndentSize(code)
  const elements: CodeElement[] = []
  const stats: CodeStats = {
    functions: 0,
    classes: 0,
    loops: 0,
    conditionals: 0,
    variables: 0,
    comments: 0,
    imports: 0,
    returns: 0,
    depth: 0,
    density: 0,
  }

  let maxDepth = 0
  let codeLineCount = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed) continue

    const depth = getIndentLevel(line, indentSize)
    if (depth > maxDepth) maxDepth = depth

    const isCode = trimmed.length > 0 && !trimmed.startsWith('//') && !trimmed.startsWith('#') && !trimmed.startsWith('/*') && !trimmed.startsWith('*')
    if (isCode) codeLineCount++

    let matched = false

    const checks: Array<{ type: CodeElementType; patternKey: keyof LanguagePattern }> = [
      { type: 'import', patternKey: 'import' },
      { type: 'decorator', patternKey: 'decorator' },
      { type: 'class', patternKey: 'class' },
      { type: 'function', patternKey: 'function' },
      { type: 'loop', patternKey: 'loop' },
      { type: 'conditional', patternKey: 'conditional' },
      { type: 'return', patternKey: 'return' },
      { type: 'variable', patternKey: 'variable' },
      { type: 'trycatch', patternKey: 'trycatch' },
      { type: 'comment', patternKey: 'comment' },
    ]

    for (const check of checks) {
      const result = matchPatterns(trimmed, patterns[check.patternKey])
      if (result.matched) {
        const element: CodeElement = {
          type: check.type,
          name: result.name,
          depth,
          line: i + 1,
          lineEnd: i + 1,
          properties: {},
        }

        if (check.type === 'function') {
          stats.functions++
          element.properties!.async = /async/.test(trimmed)
          element.properties!.exported = /export/.test(trimmed)
        } else if (check.type === 'class') {
          stats.classes++
        } else if (check.type === 'loop') {
          stats.loops++
        } else if (check.type === 'conditional') {
          stats.conditionals++
        } else if (check.type === 'variable') {
          stats.variables++
        } else if (check.type === 'comment') {
          stats.comments++
        } else if (check.type === 'import') {
          stats.imports++
        } else if (check.type === 'return') {
          stats.returns++
        }

        elements.push(element)
        matched = true
        break
      }
    }

    if (!matched && isCode) {
      const isString = /^['"`]/.test(trimmed) || /^f['"`]/.test(trimmed)
      const isNumber = /^-?\d+\.?\d*$/.test(trimmed.replace(/;$/, ''))
      const isOperator = /^[+\-*/%=<>!&|^~]+/.test(trimmed)

      let type: CodeElementType = 'assignment'
      if (isString) type = 'string'
      else if (isNumber) type = 'number'
      else if (isOperator) type = 'operator'

      elements.push({
        type,
        depth,
        line: i + 1,
        lineEnd: i + 1,
        properties: {},
      })
    }
  }

  stats.depth = maxDepth
  stats.density = codeLineCount > 0 ? elements.length / codeLineCount : 0

  const complexity = stats.functions * 3 + stats.loops * 2 + stats.conditionals * 2 + stats.depth + stats.classes * 2

  return {
    language,
    elements,
    totalLines: lines.length,
    complexity,
    stats,
  }
}
