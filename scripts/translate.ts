import { readFile } from 'node:fs/promises'
import { translate } from '../src/compiler/index.js'

const input = process.argv.slice(2).join(' ')
const source = input.startsWith('@') ? await readFile(input.slice(1), 'utf8') : input
if (!source.trim()) {
  console.error('Usage: npm run translate -- "a + b * 2"')
  console.error('   or: npm run translate -- @expression.txt')
  process.exit(1)
}
const result = translate(source)
console.log(result.success ? result.formattedCode : 'Translation failed.')
if (result.diagnostics.length) {
  for (const diagnostic of result.diagnostics) console.error(`${diagnostic.severity}: ${diagnostic.message}`)
  process.exit(1)
}
