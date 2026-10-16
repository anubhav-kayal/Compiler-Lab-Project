import { describe, expect, it } from 'vitest'
import { run } from './interpret'
import { optimize } from './optimize'
import { translateProgram } from './program'
import { samplePrograms } from './programs'

describe('statement translation', () => {
  it('translates an assignment through a temporary', () => {
    const result = translateProgram('x = a + b * 2;')
    expect(result.success).toBe(true)
    expect(result.formattedCode).toBe('t0 = b * 2\nt1 = a + t0\nx = t1')
  })

  it('emits labels for if and else', () => {
    const result = translateProgram('if (a < b) x = 1; else x = 2;')
    expect(result.formattedCode).toBe(['if a < b goto L0', 'goto L1', 'L0:', 'x = 1', 'goto L2', 'L1:', 'x = 2', 'L2:'].join('\n'))
  })

  it('emits a back edge for while', () => {
    const result = translateProgram('while (i < 3) i = i + 1;')
    expect(result.formattedCode).toContain('L0:')
    expect(result.formattedCode).toContain('goto L0')
  })

  it('rejects a non-Boolean condition', () => {
    const result = translateProgram('if (a + 1) x = 1;')
    expect(result.success).toBe(false)
    expect(result.diagnostics.some(d => d.message.includes('must be Boolean'))).toBe(true)
  })

  it('rejects changing the type of a variable', () => {
    const result = translateProgram('x = 1; x = true;')
    expect(result.success).toBe(false)
    expect(result.diagnostics.some(d => d.message.includes('cannot be assigned'))).toBe(true)
  })

  it('warns when a variable is read before assignment', () => {
    const result = translateProgram('x = y + 1;')
    expect(result.success).toBe(true)
    expect(result.diagnostics[0].severity).toBe('warning')
  })

  it('reports a missing semicolon, brace and parenthesis', () => {
    expect(translateProgram('x = 1').diagnostics.some(d => d.message.includes('“;”'))).toBe(true)
    expect(translateProgram('while (a < b) { x = 1;').diagnostics.some(d => d.message.includes('“}”'))).toBe(true)
    expect(translateProgram('if (a < b x = 1;').diagnostics.some(d => d.message.includes('“)”'))).toBe(true)
  })

  it('does not hang on incomplete or stray input', () => {
    for (const source of ['x =', 'if', 'while (', '}', ') = ;', 'else x = 1;', '{']) {
      expect(translateProgram(source).success).toBe(false)
    }
  })
})

describe('optimizer', () => {
  it('folds constants and merges copies', () => {
    const result = translateProgram('a = 2 * 3 + 4; b = a + 1;')
    expect(result.optimizedCode).toBe('a = 10\nb = a + 1')
  })

  it('removes the dead branch of a constant condition', () => {
    const result = translateProgram('if (3 < 4) c = 1; else c = 2;')
    expect(result.optimizedCode).toBe('c = 1')
  })

  it('keeps division by zero in the code instead of folding it', () => {
    const result = translateProgram('a = 4 / 0;')
    expect(result.optimizedCode).toContain('4 / 0')
  })

  it('does not change a program that has nothing to remove', () => {
    const once = optimize(translateProgram('x = a + b;').instructions)
    expect(optimize(once)).toEqual(once)
  })

  for (const sample of samplePrograms) {
    it(`keeps the behaviour of “${sample.label}”`, () => {
      const result = translateProgram(sample.source)
      expect(result.success).toBe(true)
      expect(result.optimizedInstructions!.length).toBeLessThanOrEqual(result.instructions.length)
      for (const input of sample.inputs) {
        const before = run(result.instructions, input)
        const after = run(result.optimizedInstructions!, input)
        expect(before.halted).toBe(true)
        expect(after.variables).toEqual(before.variables)
        expect(after.steps).toBeLessThanOrEqual(before.steps)
      }
    })
  }
})
