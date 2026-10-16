import { readFile, writeFile } from 'node:fs/promises'
import { run, translate, translateProgram, tokenize } from '../compiler'
import type { TranslationResult } from '../compiler'
import { samplePrograms } from '../compiler/programs'
import { parseArgs, UsageError } from './args'
import type { Options } from './args'
import { startRepl } from './repl'
import { countKinds, countNodes, heading, makeStyle, renderCode, renderDiagnostic, renderSideBySide, renderTokens, renderTree, table } from './render'
import type { Style } from './render'

export const version = '2.0.0'

const helpText = (style: Style) => `${style.bold('sdt')} ${style.gray(`v${version}`)} — syntax-directed translation to labeled three-address code

${style.bold('USAGE')}
  sdt [translate] <source|@file|file|-> [options]
  sdt run <source|file> [--set n=5]      translate, then execute the code
  sdt check <source|file>                report diagnostics only (exit 0 or 1)
  sdt repl                               interactive session
  sdt bench                              measure the optimizer on built-in programs
  sdt examples [name|number]             list or print built-in programs

${style.bold('INPUT')}
  The source can be an argument, @path, a file path, “-” for stdin, or piped text.
  Expressions and programs are told apart automatically (-e and -p force a mode).
  A program has assignments, if/else, while and { } blocks, for example
    i = 0; while (i < 3) { i = i + 1; }

${style.bold('OPTIONS')}
  -O, --optimize        print the optimized code
  -c, --compare         show original and optimized code side by side
  -t, --tokens          print the token stream
  -T, --tree            print the annotated parse tree
  -s, --stats           print counts for tokens, nodes, lines and optimizer savings
  -r, --run             execute the code after translating (same as “sdt run”)
      --set k=v[,k=v]   input values for variables read before assignment
      --example <name>  use a built-in program as the source
  -o, --output <file>   write the code to a file instead of the terminal
  -j, --json            print the whole result as JSON
  -e, --expr | -p, --program   force expression or program mode
      --no-color        turn colors off (NO_COLOR is honored too)
  -h, --help | -v, --version

${style.bold('EXIT CODES')}  0 success   1 source has errors   2 bad command line

${style.bold('EXAMPLES')}
  sdt "x < y && y != 0"
  sdt -pOc "a = 2 * 3; while (a < 20) a = a + 4;"
  sdt run --example gcd --set a=48,b=18
  echo "a + b * c" | sdt -T
`

async function readSource(options: Options): Promise<{ source: string; file: string }> {
  if (options.example) {
    const lower = options.example.toLowerCase()
    const index = Number(options.example)
    const sample = Number.isInteger(index) ? samplePrograms[index - 1] : samplePrograms.find(item => item.key === lower || item.label.toLowerCase().includes(lower))
    if (!sample) throw new UsageError(`No built-in program matches “${options.example}”. Run “sdt examples”.`)
    return { source: sample.source, file: `<example: ${sample.label}>` }
  }
  const target = options.target
  if (target === '-' || (target === undefined && !process.stdin.isTTY)) {
    const chunks: Buffer[] = []
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
    return { source: Buffer.concat(chunks).toString('utf8'), file: '<stdin>' }
  }
  if (target === undefined) throw new UsageError('No source given. Pass an expression, a file, or run “sdt repl”.')
  const path = target.startsWith('@') ? target.slice(1) : target
  if (target.startsWith('@') || !/[\s=;(){}<>!&|+*/%-]/.test(target)) {
    try { return { source: await readFile(path, 'utf8'), file: path } } catch {
      if (target.startsWith('@')) throw new UsageError(`Cannot read “${path}”.`)
    }
  }
  return { source: target, file: '<argument>' }
}

export function detectMode(source: string): 'expression' | 'program' {
  const { tokens } = tokenize(source)
  return tokens.some(token => ['assign', 'semicolon', 'lbrace', 'rbrace', 'keyword'].includes(token.kind)) ? 'program' : 'expression'
}

/** Variables given with --set are declared inputs, so reading them first is not a warning. */
export function withoutInputWarnings(result: TranslationResult, options: Options): TranslationResult {
  const names = Object.keys(options.inputs)
  if (!names.length) return result
  return { ...result, diagnostics: result.diagnostics.filter(d => !(d.severity === 'warning' && names.some(name => d.message.startsWith(`“${name}” is read`)))) }
}

export function compile(source: string, mode: Options['mode']): { result: TranslationResult; mode: 'expression' | 'program' } {
  const resolved = mode === 'auto' ? detectMode(source) : mode
  return { result: resolved === 'program' ? translateProgram(source) : translate(source), mode: resolved }
}

export function report(style: Style, result: TranslationResult, source: string, file: string, options: Options, mode: 'expression' | 'program', out: (text: string) => void): void {
  const errors = result.diagnostics.filter(d => d.severity === 'error')
  for (const diagnostic of result.diagnostics) out(renderDiagnostic(style, source, diagnostic, file) + '\n')
  if (options.tokens) out(`${heading(style, 'Tokens', `${result.tokens.length - 1}`)}\n${renderTokens(style, result.tokens)}\n`)
  if (options.tree && result.tree) out(`${heading(style, 'Annotated tree')}\n${renderTree(style, result.tree)}\n`)
  if (errors.length) {
    out(style.red(style.bold(`translation failed with ${errors.length} error${errors.length === 1 ? '' : 's'}`)) + '\n')
    return
  }
  const optimized = result.optimizedCode
  if (options.compare && optimized !== undefined) {
    out(renderSideBySide(style, result.formattedCode, optimized, `original (${result.instructions.length})`, `optimized (${result.optimizedInstructions!.length})`) + '\n')
  } else {
    const showOptimized = options.optimize && optimized !== undefined
    out(`${heading(style, showOptimized ? 'Optimized code' : 'Three-address code')}\n${renderCode(style, showOptimized ? optimized : result.formattedCode)}\n`)
  }
  if (options.stats) out(renderStats(style, result, mode) + '\n')
}

function renderStats(style: Style, result: TranslationResult, mode: string): string {
  const before = countKinds(result.instructions)
  const rows = [
    ['mode', mode], ['tokens', String(result.tokens.length - 1)], ['tree nodes', String(result.tree ? countNodes(result.tree) : 0)],
    ['lines', String(before.lines)], ['jumps', String(before.jumps)], ['labels', String(before.labels)], ['temporaries', String(before.temps)],
  ]
  if (result.optimizedInstructions) {
    const after = countKinds(result.optimizedInstructions)
    const saved = before.lines ? Math.round(100 * (before.lines - after.lines) / before.lines) : 0
    rows.push(['lines after optimizing', `${after.lines}  (${saved}% fewer)`], ['jumps after', String(after.jumps)], ['temporaries after', String(after.temps)])
  }
  return `${heading(style, 'Statistics')}\n${table(style, rows, ['metric', 'value'])}`
}

export function renderRun(style: Style, result: TranslationResult, options: Options, out: (text: string) => void): void {
  const original = run(result.instructions, options.inputs)
  const rows = Object.entries(original.variables).map(([name, value]) => [name, String(value)])
  out(`${heading(style, 'Execution', `${original.steps} steps`)}\n${rows.length ? table(style, rows, ['variable', 'value'], ['l', 'r']) : style.gray('(no variables)')}\n`)
  if (!original.halted) out(style.yellow('warning: stopped at the 100000 step limit; the code may loop forever.') + '\n')
  if (result.optimizedInstructions) {
    const optimized = run(result.optimizedInstructions, options.inputs)
    const same = JSON.stringify(optimized.variables) === JSON.stringify(original.variables)
    out(`optimized code: ${optimized.steps} steps, ${same ? style.green('same results') : style.red('RESULTS DIFFER')}\n`)
  }
}

async function bench(style: Style, json: boolean, out: (text: string) => void) {
  const rows = samplePrograms.map(sample => {
    const result = translateProgram(sample.source)
    let before = 0; let after = 0; let same = true
    for (const input of sample.inputs) {
      const a = run(result.instructions, input); const b = run(result.optimizedInstructions!, input)
      before += a.steps; after += b.steps
      if (JSON.stringify(a.variables) !== JSON.stringify(b.variables)) same = false
    }
    return { program: sample.label, linesBefore: result.instructions.length, linesAfter: result.optimizedInstructions!.length, stepsBefore: before, stepsAfter: after, same }
  })
  if (json) return out(JSON.stringify(rows, null, 2) + '\n')
  const pct = (a: number, b: number) => `${Math.round(100 * (a - b) / a)}%`
  out(table(style, rows.map(row => [row.program, String(row.linesBefore), String(row.linesAfter), pct(row.linesBefore, row.linesAfter), String(row.stepsBefore), String(row.stepsAfter), pct(row.stepsBefore, row.stepsAfter), row.same ? 'yes' : 'NO']),
    ['program', 'lines', 'after', 'saved', 'steps', 'after', 'saved', 'same'], ['l', 'r', 'r', 'r', 'r', 'r', 'r', 'l']) + '\n')
}

export async function main(argv: string[]): Promise<number> {
  let options: Options
  try { options = parseArgs(argv) } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`)
    return 2
  }
  const style = makeStyle(options.color ?? (process.env.FORCE_COLOR ? true : !!process.stdout.isTTY && !process.env.NO_COLOR))
  const out = (text: string) => process.stdout.write(text)
  try {
    if (options.command === 'help') { out(helpText(style)); return 0 }
    if (options.command === 'version') { out(`sdt ${version}\n`); return 0 }
    if (options.command === 'repl') return await startRepl(style, options)
    if (options.command === 'bench') { await bench(style, options.json, out); return 0 }
    if (options.command === 'examples') {
      if (options.target) {
        const found = options.target.match(/^\d+$/) ? samplePrograms[Number(options.target) - 1] : samplePrograms.find(item => item.key === options.target || item.label.toLowerCase().includes(options.target!.toLowerCase()))
        if (!found) throw new UsageError(`No built-in program matches “${options.target}”.`)
        out(found.source + '\n'); return 0
      }
      samplePrograms.forEach((sample, index) => out(`${style.gray(String(index + 1).padStart(2))}  ${style.bold(sample.key.padEnd(8))} ${sample.label}\n`))
      return 0
    }
    const { source, file } = await readSource(options)
    if (!source.trim()) throw new UsageError('The source is empty.')
    const compiled = compile(source, options.mode)
    const result = withoutInputWarnings(compiled.result, options); const mode = compiled.mode
    if (options.json) { out(JSON.stringify(result, null, 2) + '\n'); return result.success ? 0 : 1 }
    if (options.command === 'check') {
      for (const diagnostic of result.diagnostics) out(renderDiagnostic(style, source, diagnostic, file) + '\n')
      out(result.success ? style.green('ok') + '\n' : style.red('failed') + '\n')
      return result.success ? 0 : 1
    }
    if (options.output && result.success) {
      const code = options.optimize && result.optimizedCode !== undefined ? result.optimizedCode : result.formattedCode
      await writeFile(options.output, code + '\n')
      out(`wrote ${code.split('\n').length} lines to ${options.output}\n`)
      for (const diagnostic of result.diagnostics) out(renderDiagnostic(style, source, diagnostic, file) + '\n')
    } else report(style, result, source, file, options, mode, out)
    if (result.success && options.run) renderRun(style, result, options, out)
    return result.success ? 0 : 1
  } catch (error) {
    if (error instanceof UsageError) { process.stderr.write(`${error.message}\n`); return 2 }
    throw error
  }
}
