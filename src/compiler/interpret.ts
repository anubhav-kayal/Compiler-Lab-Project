import type { Instruction } from './types'
import { evaluateBinary } from './optimize'

export type RunResult = { variables: Record<string, number>; steps: number; halted: boolean }

/** Executes three-address code. Used to check that optimization keeps behaviour. */
export function run(code: Instruction[], inputs: Record<string, number> = {}, stepLimit = 100000): RunResult {
  const env: Record<string, number> = { ...inputs }
  const labels = new Map<string, number>()
  code.forEach((item, i) => { if (item.op === 'label') labels.set(item.label!, i) })
  const read = (name: string) => /^-?\d+$/.test(name) ? Number(name) : env[name] ?? 0
  let pc = 0; let steps = 0
  while (pc < code.length && steps < stepLimit) {
    const item = code[pc]; steps++; pc++
    if (item.op === 'label') { steps--; continue }
    if (item.op === 'goto') pc = labels.get(item.args[0])!
    else if (item.op === 'if') {
      if (evaluateBinary(item.args[1], read(item.args[0]), read(item.args[2]))) pc = labels.get(item.args[3])!
    } else if (item.op === '=') env[item.result!] = read(item.args[0])
    else if (item.op === 'neg') env[item.result!] = -read(item.args[0])
    else if (item.op === 'not') env[item.result!] = Number(!read(item.args[0]))
    else env[item.result!] = evaluateBinary(item.op, read(item.args[0]), read(item.args[1])) ?? 0
  }
  const variables = Object.fromEntries(Object.entries(env).filter(([name]) => !/^t\d+$/.test(name)))
  return { variables, steps, halted: pc >= code.length }
}
