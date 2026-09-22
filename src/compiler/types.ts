export type ValueType = 'int' | 'bool' | 'error'

export type TokenKind =
  | 'identifier' | 'number' | 'boolean' | 'operator' | 'lparen' | 'rparen' | 'eof'

export type Token = {
  kind: TokenKind
  lexeme: string
  start: number
  end: number
}

export type Diagnostic = {
  message: string
  start: number
  end: number
  severity: 'error' | 'warning'
}

export type Instruction = {
  op: string
  args: string[]
  result?: string
  label?: string
}

export type AnnotatedNode = {
  id: number
  kind: string
  value?: string
  type: ValueType
  start: number
  end: number
  place?: string
  trueLabel?: string
  falseLabel?: string
  children: AnnotatedNode[]
  code: Instruction[]
}

export type TranslationResult = {
  success: boolean
  source: string
  tokens: Token[]
  tree?: AnnotatedNode
  instructions: Instruction[]
  formattedCode: string
  diagnostics: Diagnostic[]
}
