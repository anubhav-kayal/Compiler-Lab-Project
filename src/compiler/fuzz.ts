import { run } from './interpret'
import { translateProgram } from './program'

/** Small seeded generator so a failing program can be reproduced from its seed. */
function random(seed: number) {
  let state = seed >>> 0
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 2 ** 32 }
}

export function generateProgram(seed: number): string {
  const next = random(seed)
  const pick = <T,>(items: T[]) => items[Math.floor(next() * items.length)]
  const ints = ['a', 'b', 'c', 'd']; let loops = 0
  const int = (depth: number): string => {
    if (depth <= 0 || next() < 0.3) return next() < 0.5 ? String(Math.floor(next() * 10)) : pick(ints)
    return `${int(depth - 1)} ${pick(['+', '-', '*', '/', '%'])} ${int(depth - 1)}`
  }
  const bool = (depth: number): string => {
    const roll = next()
    if (depth <= 0 || roll < 0.35) return `${int(1)} ${pick(['<', '<=', '>', '>=', '==', '!='])} ${int(1)}`
    if (roll < 0.5) return pick(['true', 'false', 'p', 'q'])
    if (roll < 0.6) return `!(${bool(depth - 1)})`
    return `(${bool(depth - 1)}) ${pick(['&&', '||'])} (${bool(depth - 1)})`
  }
  const statement = (depth: number): string => {
    const roll = next()
    if (depth <= 0 || roll < 0.4) return `${pick(ints)} = ${int(2)};`
    if (roll < 0.5) return `${pick(['p', 'q'])} = ${bool(2)};`
    if (roll < 0.75) return `if (${bool(2)}) ${block(depth - 1)}${next() < 0.5 ? ` else ${block(depth - 1)}` : ''}`
    const counter = `k${loops++}`
    return `${counter} = 0; while (${counter} < ${1 + Math.floor(next() * 4)} && (${bool(1)})) { ${block(depth - 1, false)} ${counter} = ${counter} + 1; }`
  }
  const block = (depth: number, braces = true): string => {
    const body = Array.from({ length: 1 + Math.floor(next() * 3) }, () => statement(depth)).join(' ')
    return braces ? `{ ${body} }` : body
  }
  const body = Array.from({ length: 2 + Math.floor(next() * 4) }, () => statement(3)).join('\n')
  return `p = a < b; q = true;\n${body}`
}

export type FuzzReport = { programs: number; runs: number; mismatches: string[]; linesBefore: number; linesAfter: number }

export function fuzz(count: number, firstSeed = 1): FuzzReport {
  const report: FuzzReport = { programs: 0, runs: 0, mismatches: [], linesBefore: 0, linesAfter: 0 }
  for (let seed = firstSeed; seed < firstSeed + count; seed++) {
    const source = generateProgram(seed)
    const result = translateProgram(source)
    if (!result.success) { report.mismatches.push(`seed ${seed}: did not translate`); continue }
    report.programs++; report.linesBefore += result.instructions.length; report.linesAfter += result.optimizedInstructions!.length
    for (const input of [{ a: 0, b: 0, c: 0, d: 0 }, { a: 3, b: -2, c: 7, d: 1 }, { a: -5, b: 9, c: 2, d: 4 }]) {
      const before = run(result.instructions, input); const after = run(result.optimizedInstructions!, input)
      report.runs++
      const key = (vars: Record<string, number>) => JSON.stringify(Object.entries(vars).sort())
      if (!before.halted || !after.halted || key(before.variables) !== key(after.variables) || after.steps > before.steps)
        report.mismatches.push(`seed ${seed}, input ${JSON.stringify(input)}`)
    }
  }
  return report
}
