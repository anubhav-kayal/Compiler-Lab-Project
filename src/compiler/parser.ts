import type { AnnotatedNode, Diagnostic, Token, ValueType } from './types'

export class Parser {
  private index = 0
  private nodeId = 0
  readonly diagnostics: Diagnostic[] = []
  constructor(private readonly tokens: Token[]) {}

  parse(): AnnotatedNode | undefined {
    if (this.peek().kind === 'eof') return undefined
    const root = this.parseOr()
    if (this.peek().kind !== 'eof') this.error('Expected the end of the expression.', this.peek())
    return root
  }

  private parseOr(): AnnotatedNode {
    return this.leftAssoc(() => this.parseAnd(), ['||'], 'Or')
  }
  private parseAnd(): AnnotatedNode {
    return this.leftAssoc(() => this.parseEquality(), ['&&'], 'And')
  }
  private parseEquality(): AnnotatedNode {
    return this.leftAssoc(() => this.parseRelational(), ['==', '!='], 'Equality')
  }
  private parseRelational(): AnnotatedNode {
    return this.leftAssoc(() => this.parseAdditive(), ['<', '<=', '>', '>='], 'Relational')
  }
  private parseAdditive(): AnnotatedNode {
    return this.leftAssoc(() => this.parseMultiplicative(), ['+', '-'], 'Additive')
  }
  private parseMultiplicative(): AnnotatedNode {
    return this.leftAssoc(() => this.parseUnary(), ['*', '/', '%'], 'Multiplicative')
  }
  private parseUnary(): AnnotatedNode {
    if (this.peek().kind === 'operator' && ['!', '-'].includes(this.peek().lexeme)) {
      const token = this.advance(); const child = this.parseUnary()
      return this.node('Unary', token.lexeme, token.start, child.end, [child])
    }
    return this.parsePrimary()
  }
  private parsePrimary(): AnnotatedNode {
    const token = this.advance()
    if (token.kind === 'number' || token.kind === 'identifier' || token.kind === 'boolean') {
      return this.node(token.kind === 'number' ? 'Number' : token.kind === 'boolean' ? 'Boolean' : 'Identifier', token.lexeme, token.start, token.end)
    }
    if (token.kind === 'lparen') {
      const child = this.parseOr()
      if (this.peek().kind === 'rparen') this.advance()
      else this.error('Expected “)”.', this.peek())
      return this.node('Group', undefined, token.start, this.previous().end, [child])
    }
    this.error('Expected a number, identifier, Boolean, or “(”.', token)
    return this.node('Error', token.lexeme, token.start, token.end)
  }
  private leftAssoc(parseNext: () => AnnotatedNode, operators: string[], kind: string): AnnotatedNode {
    let left = parseNext()
    while (this.peek().kind === 'operator' && operators.includes(this.peek().lexeme)) {
      const op = this.advance(); const right = parseNext()
      left = this.node(kind, op.lexeme, left.start, right.end, [left, right])
    }
    return left
  }
  private node(kind: string, value: string | undefined, start: number, end: number, children: AnnotatedNode[] = []): AnnotatedNode {
    return { id: this.nodeId++, kind, value, type: 'error', start, end, children, code: [] }
  }
  private peek(): Token { return this.tokens[this.index] }
  private previous(): Token { return this.tokens[Math.max(0, this.index - 1)] }
  private advance(): Token { return this.tokens[this.index++] }
  private error(message: string, token: Token): void { this.diagnostics.push({ message, start: token.start, end: token.end, severity: 'error' }) }
}
