import type { AnnotatedNode, Diagnostic, Instruction, Token } from '../compiler'

export type Style = ReturnType<typeof makeStyle>

export function makeStyle(enabled: boolean) {
  const wrap = (open: number, close = 39) => (text: string) => enabled ? `\u001b[${open}m${text}\u001b[${close}m` : text
  return {
    enabled,
    bold: wrap(1, 22), dim: wrap(2, 22), red: wrap(31), green: wrap(32), yellow: wrap(33),
    blue: wrap(34), magenta: wrap(35), cyan: wrap(36), gray: wrap(90),
  }
}

export function heading(style: Style, title: string, note = ''): string {
  return `${style.bold(style.cyan(title))}${note ? style.gray(`  ${note}`) : ''}`
}

/** Prints a diagnostic with its line and a caret underline, in the style of a compiler. */
export function renderDiagnostic(style: Style, source: string, diagnostic: Diagnostic, file: string): string {
  const color = diagnostic.severity === 'error' ? style.red : style.yellow
  const before = source.slice(0, diagnostic.start)
  const line = before.split('\n').length
  const lineStart = before.lastIndexOf('\n') + 1
  const lineEnd = source.indexOf('\n', diagnostic.start) === -1 ? source.length : source.indexOf('\n', diagnostic.start)
  const column = diagnostic.start - lineStart + 1
  const width = Math.max(1, Math.min(diagnostic.end, lineEnd) - diagnostic.start)
  const gutter = String(line).length
  const pad = ' '.repeat(gutter)
  return [
    `${color(style.bold(diagnostic.severity))}${style.bold(`: ${diagnostic.message}`)}`,
    `${pad}${style.blue('-->')} ${file}:${line}:${column}`,
    `${pad} ${style.blue('|')}`,
    `${style.blue(String(line))} ${style.blue('|')} ${source.slice(lineStart, lineEnd)}`,
    `${pad} ${style.blue('|')} ${' '.repeat(column - 1)}${color('^'.repeat(width))}`,
  ].join('\n')
}

export function renderTokens(style: Style, tokens: Token[]): string {
  const shown = tokens.filter(token => token.kind !== 'eof')
  const kindWidth = Math.max(4, ...shown.map(token => token.kind.length))
  const rows = shown.map((token, index) =>
    `${style.gray(String(index).padStart(3))}  ${style.cyan(token.kind.padEnd(kindWidth))}  ${style.bold(token.lexeme)}  ${style.gray(`${token.start}-${token.end}`)}`)
  return rows.join('\n') || style.gray('(no tokens)')
}

export function renderTree(style: Style, root: AnnotatedNode): string {
  const lines: string[] = []
  const label = (node: AnnotatedNode) => {
    const typeColor = node.type === 'bool' ? style.magenta : node.type === 'int' ? style.green : style.red
    const attributes = [
      node.place && `place=${node.place}`, node.trueLabel && `true=${node.trueLabel}`, node.falseLabel && `false=${node.falseLabel}`,
    ].filter(Boolean).join(' ')
    return `${style.bold(node.kind)}${node.value ? ` ${style.yellow(node.value)}` : ''} ${typeColor(node.type)}${attributes ? ` ${style.gray(`[${attributes}]`)}` : ''}`
  }
  const walk = (node: AnnotatedNode, prefix: string, last: boolean, top: boolean) => {
    lines.push(`${top ? '' : prefix + style.gray(last ? '└─ ' : '├─ ')}${label(node)}`)
    const childPrefix = top ? '' : prefix + (last ? '   ' : style.gray('│  '))
    node.children.forEach((child, index) => walk(child, childPrefix, index === node.children.length - 1, false))
  }
  walk(root, '', true, true)
  return lines.join('\n')
}

export function renderCode(style: Style, code: string): string {
  const lines = code ? code.split('\n') : []
  const width = String(lines.length).length
  return lines.map((line, index) => {
    const color = line.endsWith(':') ? style.yellow : /^(if|goto)\b/.test(line) ? style.cyan : (text: string) => text
    const indent = line.endsWith(':') ? '' : '  '
    return `${style.gray(String(index + 1).padStart(width))}  ${indent}${color(line)}`
  }).join('\n') || style.gray('(no code)')
}

/** Two code listings side by side, used by --compare. */
export function renderSideBySide(style: Style, left: string, right: string, leftTitle: string, rightTitle: string): string {
  const a = left ? left.split('\n') : []; const b = right ? right.split('\n') : []
  const width = Math.max(leftTitle.length, ...a.map(line => line.length)) + 4
  const cell = (line: string) => colorLine(style, line) + ' '.repeat(width - line.length)
  const out = [style.bold(leftTitle.padEnd(width)) + style.bold(rightTitle), style.gray('─'.repeat(width - 2) + '  ' + '─'.repeat(Math.max(rightTitle.length, ...b.map(line => line.length))))]
  for (let i = 0; i < Math.max(a.length, b.length); i++) out.push(cell(a[i] ?? '') + colorLine(style, b[i] ?? ''))
  return out.join('\n')
}

function colorLine(style: Style, line: string): string {
  return line.endsWith(':') ? style.yellow(line) : /^(if|goto)\b/.test(line) ? style.cyan(line) : line
}

export function countNodes(node: AnnotatedNode): number {
  return 1 + node.children.reduce((total, child) => total + countNodes(child), 0)
}

export function countKinds(code: Instruction[]) {
  return {
    lines: code.length,
    labels: code.filter(item => item.op === 'label').length,
    jumps: code.filter(item => item.op === 'goto' || item.op === 'if').length,
    temps: new Set(code.map(item => item.result).filter(name => name && /^t\d+$/.test(name))).size,
  }
}

export function table(style: Style, rows: string[][], header: string[], align: ('l' | 'r')[] = []): string {
  const widths = header.map((cell, column) => Math.max(cell.length, ...rows.map(row => row[column].length)))
  const fit = (cell: string, column: number) => align[column] === 'r' ? cell.padStart(widths[column]) : cell.padEnd(widths[column])
  return [
    style.bold(header.map(fit).join('  ')),
    style.gray(widths.map(width => '─'.repeat(width)).join('  ')),
    ...rows.map(row => row.map(fit).join('  ')),
  ].join('\n')
}
