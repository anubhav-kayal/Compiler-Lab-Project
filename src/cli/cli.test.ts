import { describe, expect, it } from 'vitest'
import { translateProgram } from '../compiler'
import { parseArgs, UsageError } from './args'
import { compile, detectMode, withoutInputWarnings } from './main'
import { makeStyle, renderDiagnostic, renderTree } from './render'

describe('command line parsing', () => {
  it('reads a subcommand, flags and the source', () => {
    const options = parseArgs(['run', '-O', '--set', 'n=5,x=-2', 'i = 0;'])
    expect(options.command).toBe('run')
    expect(options.run).toBe(true)
    expect(options.optimize).toBe(true)
    expect(options.inputs).toEqual({ n: 5, x: -2 })
    expect(options.target).toBe('i = 0;')
  })

  it('splits bundled short flags', () => {
    const options = parseArgs(['-pOc', 'x = 1;'])
    expect([options.mode, options.optimize, options.compare]).toEqual(['program', true, true])
  })

  it('keeps a negative number as part of the source', () => {
    expect(parseArgs(['-5 + 3']).target).toBe('-5 + 3')
  })

  it('rejects unknown options and bad --set values', () => {
    expect(() => parseArgs(['--nope'])).toThrow(UsageError)
    expect(() => parseArgs(['--set', 'n=abc'])).toThrow(UsageError)
    expect(() => parseArgs(['--set'])).toThrow(UsageError)
  })
})

describe('mode detection and reporting', () => {
  it('tells expressions from programs', () => {
    expect(detectMode('a + b * c')).toBe('expression')
    expect(detectMode('x = 1;')).toBe('program')
    expect(detectMode('while (a < b) a = a + 1;')).toBe('program')
  })

  it('drops warnings for variables declared with --set', () => {
    const result = translateProgram('x = n + m;')
    const filtered = withoutInputWarnings(result, { ...parseArgs(['--set', 'n=1']) })
    expect(filtered.diagnostics.map(d => d.message).join()).toContain('“m”')
    expect(filtered.diagnostics.map(d => d.message).join()).not.toContain('“n”')
  })

  it('points a caret at the offending column', () => {
    const { result } = compile('a +\nb * ;', 'expression')
    const text = renderDiagnostic(makeStyle(false), 'a +\nb * ;', result.diagnostics[0], 'f.txt')
    expect(text).toContain('f.txt:')
    expect(text).toContain('^')
  })

  it('renders the tree with types and no stray color codes when color is off', () => {
    const { result } = compile('a + 1', 'expression')
    const text = renderTree(makeStyle(false), result.tree!)
    expect(text).toContain('Additive + int')
    expect(text).not.toContain('\u001b')
  })

  it('types statement nodes as void', () => {
    expect(translateProgram('x = 1;').tree!.type).toBe('void')
  })
})
