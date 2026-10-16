import { instruction } from './translator'
import type { Instruction } from './types'

const inverse: Record<string, string> = { '<': '>=', '>=': '<', '>': '<=', '<=': '>', '==': '!=', '!=': '==' }
const isLiteral = (value: string) => /^-?\d+$/.test(value)

export function evaluateBinary(op: string, a: number, b: number): number | undefined {
  switch (op) {
    case '+': return a + b
    case '-': return a - b
    case '*': return a * b
    case '/': return b === 0 ? undefined : Math.trunc(a / b)
    case '%': return b === 0 ? undefined : a % b
    case '<': return Number(a < b)
    case '<=': return Number(a <= b)
    case '>': return Number(a > b)
    case '>=': return Number(a >= b)
    case '==': return Number(a === b)
    case '!=': return Number(a !== b)
  }
}

/** Runs the passes below until none of them changes the code. */
export function optimize(code: Instruction[]): Instruction[] {
  let current = code.map(item => ({ ...item, args: [...item.args] }))
  for (let round = 0; round < 20; round++) {
    const next = [propagateTemps, foldConstants, mergeCopies, invertBranches, threadJumps, removeDeadJumps, removeUnreachable, removeUnusedLabels]
      .reduce((acc, pass) => pass(acc), current)
    const same = JSON.stringify(next) === JSON.stringify(current)
    current = next
    if (same) break
  }
  return current
}

const isTemp = (name?: string) => !!name && /^t\d+$/.test(name)

/** A temporary with one definition that is a literal can be replaced by that literal. */
function propagateTemps(code: Instruction[]): Instruction[] {
  const definitions = new Map<string, Instruction[]>()
  for (const item of code) if (item.result && isTemp(item.result)) definitions.set(item.result, [...(definitions.get(item.result) ?? []), item])
  const constants = new Map<string, string>()
  for (const [name, defs] of definitions) if (defs.length === 1 && defs[0].op === '=' && isLiteral(defs[0].args[0])) constants.set(name, defs[0].args[0])
  if (!constants.size) return code
  return code
    .filter(item => !(item.op === '=' && item.result && constants.has(item.result)))
    .map(item => item.op === 'label' || item.op === 'goto' ? item : { ...item, args: item.args.map((arg, i) => item.op === 'if' && (i === 1 || i === 3) ? arg : constants.get(arg) ?? arg) })
}

function foldConstants(code: Instruction[]): Instruction[] {
  const out: Instruction[] = []
  for (const item of code) {
    if (item.op === 'neg' && isLiteral(item.args[0])) out.push(instruction('=', [String(-Number(item.args[0]))], item.result))
    else if (item.result && item.args.length === 2 && !['label', 'goto', 'if'].includes(item.op) && isLiteral(item.args[0]) && isLiteral(item.args[1])) {
      const value = evaluateBinary(item.op, Number(item.args[0]), Number(item.args[1]))
      out.push(value === undefined ? item : instruction('=', [String(value)], item.result))
    } else if (item.op === 'if' && isLiteral(item.args[0]) && isLiteral(item.args[2])) {
      const value = evaluateBinary(item.args[1], Number(item.args[0]), Number(item.args[2]))
      if (value) out.push(instruction('goto', [item.args[3]]))
    } else out.push(item)
  }
  return out
}

/** `t = a op b` followed by `x = t` becomes `x = a op b` when t is used nowhere else. */
function mergeCopies(code: Instruction[]): Instruction[] {
  const uses = new Map<string, number>()
  for (const item of code) {
    const used = item.op === 'if' ? [item.args[0], item.args[2]] : item.op === 'label' || item.op === 'goto' ? [] : item.args
    used.forEach(arg => uses.set(arg, (uses.get(arg) ?? 0) + 1))
  }
  const out: Instruction[] = []
  for (let i = 0; i < code.length; i++) {
    const def = code[i]; const copy = code[i + 1]
    if (isTemp(def.result) && !['=', 'label', 'goto', 'if'].includes(def.op) && copy?.op === '=' && copy.args[0] === def.result && uses.get(def.result!) === 1 && !isTemp(copy.result)) {
      out.push({ ...def, result: copy.result }); i++
    } else out.push(def)
  }
  return out
}

/** `if a < b goto T; goto F; T:` becomes `if a >= b goto F; T:`. */
function invertBranches(code: Instruction[]): Instruction[] {
  const out: Instruction[] = []
  for (let i = 0; i < code.length; i++) {
    const [branch, jump, target] = [code[i], code[i + 1], code[i + 2]]
    if (branch.op === 'if' && jump?.op === 'goto' && target?.op === 'label' && target.label === branch.args[3]) {
      out.push(instruction('if', [branch.args[0], inverse[branch.args[1]], branch.args[2], jump.args[0]])); i++
    } else out.push(branch)
  }
  return out
}

/** A jump to a label that is immediately followed by `goto M` can go straight to M. */
function threadJumps(code: Instruction[]): Instruction[] {
  const forward = new Map<string, string>()
  code.forEach((item, i) => {
    if (item.op !== 'label') return
    let next = i + 1
    while (code[next]?.op === 'label') next++
    if (code[next]?.op === 'goto') forward.set(item.label!, code[next].args[0])
  })
  const resolve = (name: string) => {
    const seen = new Set<string>()
    while (forward.has(name) && !seen.has(name)) { seen.add(name); name = forward.get(name)! }
    return name
  }
  return code.map(item => item.op === 'goto' ? { ...item, args: [resolve(item.args[0])] }
    : item.op === 'if' ? { ...item, args: [...item.args.slice(0, 3), resolve(item.args[3])] } : item)
}

function removeDeadJumps(code: Instruction[]): Instruction[] {
  return code.filter((item, i) => {
    if (item.op !== 'goto') return true
    for (let next = i + 1; code[next]?.op === 'label'; next++) if (code[next].label === item.args[0]) return false
    return true
  })
}

function removeUnreachable(code: Instruction[]): Instruction[] {
  const out: Instruction[] = []
  let reachable = true
  for (const item of code) {
    if (item.op === 'label') reachable = true
    if (!reachable) continue
    out.push(item)
    if (item.op === 'goto') reachable = false
  }
  return out
}

function removeUnusedLabels(code: Instruction[]): Instruction[] {
  const targets = new Set<string>()
  for (const item of code) {
    if (item.op === 'goto') targets.add(item.args[0])
    if (item.op === 'if') targets.add(item.args[3])
  }
  return code.filter(item => item.op !== 'label' || targets.has(item.label!))
}
