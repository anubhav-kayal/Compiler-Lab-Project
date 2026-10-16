import { describe, expect, it } from 'vitest'
import { fuzz } from './fuzz'

describe('random programs', () => {
  it('give the same variables before and after optimizing', () => {
    const report = fuzz(1000)
    expect(report.mismatches).toEqual([])
    expect(report.programs).toBe(1000)
    expect(report.linesAfter).toBeLessThan(report.linesBefore)
  })
})
