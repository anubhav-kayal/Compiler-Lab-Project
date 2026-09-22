import { tokenize } from './lexer'
import { Parser } from './parser'
import type { AnnotatedNode, Diagnostic, Instruction, TranslationResult, ValueType } from './types'

class Generator {
  temp = 0
  label = 0
  nextTemp() { return `t${this.temp++}` }
  nextLabel() { return `L${this.label++}` }
}

function instruction(op: string, args: string[], result?: string, label?: string): Instruction {
  return { op, args, result, label }
}

export function translate(source: string): TranslationResult {
  const lexed = tokenize(source)
  const parser = new Parser(lexed.tokens)
  const tree = parser.parse()
  const diagnostics = [...lexed.diagnostics, ...parser.diagnostics]
  if (!tree || diagnostics.some(d => d.severity === 'error')) {
    return { success: false, source, tokens: lexed.tokens, instructions: [], formattedCode: '', diagnostics }
  }
  const generator = new Generator()
  const instructions: Instruction[] = []
  analyze(tree, diagnostics)
  if (diagnostics.some(d => d.severity === 'error')) {
    return { success: false, source, tokens: lexed.tokens, tree, instructions: [], formattedCode: '', diagnostics }
  }
  emitValue(tree, generator, instructions)
  return { success: true, source, tokens: lexed.tokens, tree, instructions, formattedCode: formatCode(instructions), diagnostics }
}

function analyze(node: AnnotatedNode, diagnostics: Diagnostic[]): ValueType {
  node.children.forEach(child => analyze(child, diagnostics))
  if (node.kind === 'Number' || node.kind === 'Identifier') node.type = 'int'
  else if (node.kind === 'Boolean') node.type = 'bool'
  else if (node.kind === 'Group') node.type = node.children[0].type
  else if (node.kind === 'Unary') {
    const type = node.children[0].type
    node.type = node.value === '!' ? 'bool' : 'int'
    if ((node.value === '!' && type !== 'bool') || (node.value === '-' && type !== 'int'))
      typeError(diagnostics, node, `Unary “${node.value}” needs a ${node.value === '!' ? 'Boolean' : 'integer'} operand.`)
  } else {
    const [left, right] = node.children
    const booleanOp = ['&&', '||', '==', '!=', '<', '<=', '>', '>='].includes(node.value ?? '')
    const arithmeticOp = ['+', '-', '*', '/', '%'].includes(node.value ?? '')
    if (booleanOp && ['&&', '||'].includes(node.value ?? '') && (left.type !== 'bool' || right.type !== 'bool'))
      typeError(diagnostics, node, `Operator “${node.value}” needs two Boolean operands.`)
    if (booleanOp && ['<', '<=', '>', '>='].includes(node.value ?? '') && (left.type !== 'int' || right.type !== 'int'))
      typeError(diagnostics, node, `Operator “${node.value}” needs two integer operands.`)
    if (node.value && ['==', '!='].includes(node.value) && left.type !== right.type)
      typeError(diagnostics, node, 'Equality operands must have the same type.')
    if (arithmeticOp && (left.type !== 'int' || right.type !== 'int'))
      typeError(diagnostics, node, `Operator “${node.value}” needs two integer operands.`)
    node.type = booleanOp ? 'bool' : 'int'
  }
  return node.type
}

function typeError(diagnostics: Diagnostic[], node: AnnotatedNode, message: string) {
  diagnostics.push({ message, start: node.start, end: node.end, severity: 'error' })
  node.type = 'error'
}

function emitValue(node: AnnotatedNode, gen: Generator, output: Instruction[]): string {
  if (node.type === 'bool') return emitBooleanValue(node, gen, output)
  if (node.kind === 'Number' || node.kind === 'Identifier') { node.place = node.value; return node.place! }
  if (node.kind === 'Group') { node.place = emitValue(node.children[0], gen, output); node.code = [...node.children[0].code]; return node.place }
  if (node.kind === 'Unary') {
    const place = gen.nextTemp(); const child = emitValue(node.children[0], gen, output)
    output.push(instruction(node.value === '-' ? 'neg' : 'not', [child], place)); node.place = place; node.code.push(...output); return place
  }
  const left = emitValue(node.children[0], gen, output); const right = emitValue(node.children[1], gen, output)
  const place = gen.nextTemp(); output.push(instruction(node.value!, [left, right], place)); node.place = place; node.code.push(...output); return place
}

function emitBooleanValue(node: AnnotatedNode, gen: Generator, output: Instruction[]): string {
  const place = gen.nextTemp(); const trueLabel = gen.nextLabel(); const falseLabel = gen.nextLabel(); const end = gen.nextLabel()
  node.place = place; node.trueLabel = trueLabel; node.falseLabel = falseLabel
  emitBoolean(node, gen, output, trueLabel, falseLabel)
  output.push(instruction('label', [], undefined, trueLabel), instruction('=', ['1'], place), instruction('goto', [end]))
  output.push(instruction('label', [], undefined, falseLabel), instruction('=', ['0'], place), instruction('label', [], undefined, end))
  return place
}

function emitBoolean(node: AnnotatedNode, gen: Generator, output: Instruction[], yes: string, no: string) {
  if (node.kind === 'Group') return emitBoolean(node.children[0], gen, output, yes, no)
  if (node.kind === 'Unary' && node.value === '!') return emitBoolean(node.children[0], gen, output, no, yes)
  if (node.value === '&&') { const next = gen.nextLabel(); emitBoolean(node.children[0], gen, output, next, no); output.push(instruction('label', [], undefined, next)); return emitBoolean(node.children[1], gen, output, yes, no) }
  if (node.value === '||') { const next = gen.nextLabel(); emitBoolean(node.children[0], gen, output, yes, next); output.push(instruction('label', [], undefined, next)); return emitBoolean(node.children[1], gen, output, yes, no) }
  const left = emitValue(node.children[0], gen, output); const right = emitValue(node.children[1], gen, output)
  if (node.kind === 'Boolean') { output.push(instruction('if', [node.value === 'true' ? 'true' : 'false', '!=', '0', yes]), instruction('goto', [no])); return }
  output.push(instruction('if', [left, node.value!, right, yes]), instruction('goto', [no]))
}

function formatCode(code: Instruction[]): string {
  return code.map(item => {
    if (item.op === 'label') return `${item.label}:`
    if (item.op === 'if') return `if ${item.args[0]} ${item.args[1]} ${item.args[2]} goto ${item.args[3]}`
    if (item.op === 'goto') return `goto ${item.args[0]}`
    if (item.op === '=') return `${item.result} = ${item.args[0]}`
    if (item.op === 'neg' || item.op === 'not') return `${item.result} = ${item.op} ${item.args[0]}`
    return `${item.result} = ${item.args.join(` ${item.op} `)}`
  }).join('\n')
}
