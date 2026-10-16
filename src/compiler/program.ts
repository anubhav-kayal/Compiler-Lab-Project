import { tokenize } from './lexer'
import { optimize } from './optimize'
import { Parser } from './parser'
import { analyze, emitBoolean, emitValue, formatCode, Generator, instruction } from './translator'
import type { SymbolTable } from './translator'
import type { AnnotatedNode, Diagnostic, Instruction, TranslationResult } from './types'

export function translateProgram(source: string): TranslationResult {
  const lexed = tokenize(source)
  const parser = new Parser(lexed.tokens)
  const tree = parser.parseProgram()
  const diagnostics = [...lexed.diagnostics, ...parser.diagnostics]
  const failed = (): TranslationResult =>
    ({ success: false, source, tokens: lexed.tokens, tree, instructions: [], formattedCode: '', diagnostics })
  if (!tree || diagnostics.some(d => d.severity === 'error')) return failed()
  analyzeStatement(tree, diagnostics, { types: new Map(), defined: new Set() })
  if (diagnostics.some(d => d.severity === 'error')) return failed()
  const gen = new Generator()
  const instructions: Instruction[] = []
  emitStatement(tree, gen, instructions)
  const optimizedInstructions = optimize(instructions)
  return {
    success: true, source, tokens: lexed.tokens, tree, instructions, formattedCode: formatCode(instructions), diagnostics,
    optimizedInstructions, optimizedCode: formatCode(optimizedInstructions),
  }
}

function analyzeStatement(node: AnnotatedNode, diagnostics: Diagnostic[], symbols: SymbolTable): void {
  if (node.kind === 'Program' || node.kind === 'Block') {
    node.type = 'void'
    node.children.forEach(child => analyzeStatement(child, diagnostics, symbols))
  } else if (node.kind === 'Assign') {
    const type = analyze(node.children[0], diagnostics, symbols)
    const known = symbols.types.get(node.value!)
    if (type !== 'error' && known && known !== type) {
      diagnostics.push({ message: `“${node.value}” holds ${known === 'int' ? 'an integer' : 'a Boolean'} and cannot be assigned ${type === 'int' ? 'an integer' : 'a Boolean'}.`, start: node.start, end: node.end, severity: 'error' })
    } else if (type !== 'error' && !known) symbols.types.set(node.value!, type)
    symbols.defined.add(node.value!)
    node.type = type
  } else if (node.kind === 'If' || node.kind === 'While') {
    const [condition, ...body] = node.children
    node.type = 'void'
    if (analyze(condition, diagnostics, symbols) !== 'bool' && condition.type !== 'error') {
      diagnostics.push({ message: `The condition of “${node.kind === 'If' ? 'if' : 'while'}” must be Boolean.`, start: condition.start, end: condition.end, severity: 'error' })
    }
    body.forEach(child => analyzeStatement(child, diagnostics, symbols))
  }
}

function emitStatement(node: AnnotatedNode, gen: Generator, output: Instruction[]): void {
  const label = (name: string) => output.push(instruction('label', [], undefined, name))
  if (node.kind === 'Program' || node.kind === 'Block') {
    node.children.forEach(child => emitStatement(child, gen, output))
  } else if (node.kind === 'Assign') {
    const place = emitValue(node.children[0], gen, output)
    output.push(instruction('=', [place], node.value))
  } else if (node.kind === 'If') {
    const [condition, thenBranch, elseBranch] = node.children
    const yes = gen.nextLabel(); const no = gen.nextLabel()
    node.trueLabel = yes; node.falseLabel = no
    emitBoolean(condition, gen, output, yes, no)
    label(yes); emitStatement(thenBranch, gen, output)
    if (elseBranch) {
      const end = gen.nextLabel()
      output.push(instruction('goto', [end])); label(no)
      emitStatement(elseBranch, gen, output); label(end)
    } else label(no)
  } else if (node.kind === 'While') {
    const [condition, body] = node.children
    const begin = gen.nextLabel(); const yes = gen.nextLabel(); const no = gen.nextLabel()
    node.trueLabel = yes; node.falseLabel = no
    label(begin); emitBoolean(condition, gen, output, yes, no)
    label(yes); emitStatement(body, gen, output)
    output.push(instruction('goto', [begin])); label(no)
  }
}
