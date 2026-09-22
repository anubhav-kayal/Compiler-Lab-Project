import { describe, expect, it } from 'vitest'
import { translate } from './translator'

describe('syntax-directed translation', () => {
  it('respects arithmetic precedence', () => {
    const result = translate('a + b * c')
    expect(result.success).toBe(true)
    expect(result.formattedCode).toContain('t0 = b * c')
    expect(result.formattedCode).toContain('t1 = a + t0')
  })

  it('emits short-circuit labels for Boolean expressions', () => {
    const result = translate('x < y && y != 0')
    expect(result.success).toBe(true)
    expect(result.formattedCode).toContain('if x < y goto L')
    expect(result.formattedCode).toContain('if y != 0 goto L')
    expect(result.formattedCode).toContain('t0 = 1')
  })

  it('reports type errors', () => {
    const result = translate('true + 2')
    expect(result.success).toBe(false)
    expect(result.diagnostics[0].message).toContain('integer operands')
  })

  it('reports malformed input', () => {
    const result = translate('(a + 2')
    expect(result.success).toBe(false)
    expect(result.diagnostics.some(d => d.message.includes(')'))).toBe(true)
  })

  it('does not crash while an expression is incomplete', () => {
    const result = translate('a +')
    expect(result.success).toBe(false)
    expect(result.diagnostics.length).toBeGreaterThan(0)
  })
})
