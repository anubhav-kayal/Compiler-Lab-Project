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

  parseProgram(): AnnotatedNode | undefined {
    if (this.peek().kind === 'eof') return undefined
    const statements: AnnotatedNode[] = []
    while (this.peek().kind !== 'eof') statements.push(this.parseStatement())
    const last = statements[statements.length - 1]
    return this.node('Program', undefined, statements[0].start, last.end, statements)
  }

  private parseStatement(): AnnotatedNode {
    const token = this.peek()
    if (token.kind === 'lbrace') {
      this.advance()
      const body: AnnotatedNode[] = []
      while (this.peek().kind !== 'rbrace' && this.peek().kind !== 'eof') body.push(this.parseStatement())
      if (this.peek().kind === 'rbrace') this.advance()
      else this.error('Expected “}”.', this.peek())
      return this.node('Block', undefined, token.start, this.previous().end, body)
    }
    if (token.kind === 'keyword' && (token.lexeme === 'if' || token.lexeme === 'while')) {
      this.advance()
      const condition = this.parseCondition()
      const body = this.parseStatement()
      const children = [condition, body]
      if (token.lexeme === 'if' && this.peek().kind === 'keyword' && this.peek().lexeme === 'else') {
        this.advance()
        children.push(this.parseStatement())
      }
      return this.node(token.lexeme === 'if' ? 'If' : 'While', undefined, token.start, children[children.length - 1].end, children)
    }
    if (token.kind === 'identifier' && this.tokens[this.index + 1]?.kind === 'assign') {
      this.advance(); this.advance()
      const value = this.parseOr()
      if (this.peek().kind === 'semicolon') this.advance()
      else this.error('Expected “;”.', this.peek())
      return this.node('Assign', token.lexeme, token.start, this.previous().end, [value])
    }
    this.error('Expected a statement: an assignment, “if”, “while”, or “{”.', token)
    this.advance()
    return this.node('Error', token.lexeme, token.start, token.end)
  }

  private parseCondition(): AnnotatedNode {
    if (this.peek().kind !== 'lparen') {
      this.error('Expected “(” after the keyword.', this.peek())
      return this.node('Error', undefined, this.peek().start, this.peek().end)
    }
    this.advance()
    const condition = this.parseOr()
    if (this.peek().kind === 'rparen') this.advance()
    else this.error('Expected “)”.', this.peek())
    return condition
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
  private peek(): Token { return this.tokens[Math.min(this.index, this.tokens.length - 1)] }
  private previous(): Token { return this.tokens[Math.max(0, Math.min(this.index - 1, this.tokens.length - 1))] }
  private advance(): Token {
    const token = this.peek()
    if (token.kind !== 'eof') this.index++
    return token
  }
  private error(message: string, token: Token): void { this.diagnostics.push({ message, start: token.start, end: token.end, severity: 'error' }) }
}
