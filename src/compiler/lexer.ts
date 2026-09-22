import type { Diagnostic, Token } from './types'

const twoChar = new Set(['&&', '||', '==', '!=', '<=', '>='])
const oneChar = new Set(['+', '-', '*', '/', '%', '!', '<', '>', '(', ')'])

export function tokenize(source: string): { tokens: Token[]; diagnostics: Diagnostic[] } {
  const tokens: Token[] = []
  const diagnostics: Diagnostic[] = []
  let index = 0
  while (index < source.length) {
    const char = source[index]
    if (/\s/.test(char)) { index++; continue }
    const start = index
    if (/[A-Za-z_]/.test(char)) {
      index++
      while (index < source.length && /[A-Za-z0-9_]/.test(source[index])) index++
      const lexeme = source.slice(start, index)
      tokens.push({ kind: lexeme === 'true' || lexeme === 'false' ? 'boolean' : 'identifier', lexeme, start, end: index })
      continue
    }
    if (/[0-9]/.test(char)) {
      index++
      while (index < source.length && /[0-9]/.test(source[index])) index++
      tokens.push({ kind: 'number', lexeme: source.slice(start, index), start, end: index })
      continue
    }
    const pair = source.slice(index, index + 2)
    if (twoChar.has(pair)) {
      tokens.push({ kind: 'operator', lexeme: pair, start, end: index + 2 }); index += 2; continue
    }
    if (oneChar.has(char)) {
      const kind = char === '(' ? 'lparen' : char === ')' ? 'rparen' : 'operator'
      tokens.push({ kind, lexeme: char, start, end: index + 1 }); index++; continue
    }
    diagnostics.push({ message: `Unexpected character “${char}”.`, start, end: start + 1, severity: 'error' })
    index++
  }
  tokens.push({ kind: 'eof', lexeme: '', start: source.length, end: source.length })
  return { tokens, diagnostics }
}
