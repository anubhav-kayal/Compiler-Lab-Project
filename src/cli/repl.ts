import { createInterface } from 'node:readline/promises'
import type { TranslationResult } from '../compiler'
import type { Options } from './args'
import { compile, renderRun, report, version, withoutInputWarnings } from './main'
import { heading } from './render'
import type { Style } from './render'

const replHelp = `Type an expression or a program and press Enter. A line that opens “{” continues until the braces close.
Commands
  :mode auto|expr|prog   choose how input is read
  :opt                   toggle optimized output
  :compare               toggle original/optimized side by side
  :tokens  :tree  :stats toggle those sections
  :run                   toggle executing the code after translating
  :set n=5,x=2           values for input variables  (:set alone clears them)
  :show                  print the current settings
  :help   :quit`

export async function startRepl(style: Style, base: Options): Promise<number> {
  const options: Options = { ...base, inputs: { ...base.inputs } }
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: !!process.stdin.isTTY })
  const out = (text: string) => process.stdout.write(text)
  out(`${style.bold('sdt')} ${style.gray(`v${version} interactive`)}  ${style.gray(':help for commands, :quit to leave')}\n`)
  let buffer = ''
  const prompt = () => { rl.setPrompt(buffer ? style.gray('...> ') : style.cyan('sdt> ')); rl.prompt() }
  prompt()
  for await (const line of rl) {
    if (!buffer && line.trim().startsWith(':')) {
      if (!command(line.trim(), options, style, out)) break
      prompt(); continue
    }
    buffer += (buffer ? '\n' : '') + line
    const open = (buffer.match(/\{/g) ?? []).length - (buffer.match(/\}/g) ?? []).length
    if (open <= 0) {
      const source = buffer; buffer = ''
      if (source.trim()) {
        const { result, mode } = compile(source, options.mode)
        report(style, withoutInputWarnings(result, options), source, '<repl>', options, mode, out)
        if (result.success && options.run) renderRun(style, result, options, out)
      }
    }
    prompt()
  }
  rl.close()
  return 0
}

function command(line: string, options: Options, style: Style, out: (text: string) => void): boolean {
  const [name, ...args] = line.split(/\s+/)
  const flip = (key: 'optimize' | 'compare' | 'tokens' | 'tree' | 'stats' | 'run') => { options[key] = !options[key]; out(`${key}: ${options[key] ? 'on' : 'off'}\n`) }
  switch (name) {
    case ':quit': case ':q': case ':exit': return false
    case ':help': case ':h': out(replHelp + '\n'); break
    case ':opt': flip('optimize'); break
    case ':compare': flip('compare'); break
    case ':tokens': flip('tokens'); break
    case ':tree': flip('tree'); break
    case ':stats': flip('stats'); break
    case ':run': flip('run'); break
    case ':mode': {
      const next = { auto: 'auto', expr: 'expression', expression: 'expression', prog: 'program', program: 'program' }[args[0] as string]
      if (!next) out('usage: :mode auto|expr|prog\n')
      else { options.mode = next as Options['mode']; out(`mode: ${next}\n`) }
      break
    }
    case ':set': {
      options.inputs = {}
      for (const pair of args.join('').split(',').filter(Boolean)) {
        const match = /^([A-Za-z_]\w*)=(-?\d+)$/.exec(pair)
        if (match) options.inputs[match[1]] = Number(match[2]); else out(`ignored “${pair}”; use name=integer\n`)
      }
      out(`inputs: ${JSON.stringify(options.inputs)}\n`)
      break
    }
    case ':show':
      out(`${heading(style, 'Settings')}\n  mode ${options.mode}, optimize ${options.optimize}, compare ${options.compare}, tokens ${options.tokens}, tree ${options.tree}, stats ${options.stats}, run ${options.run}\n  inputs ${JSON.stringify(options.inputs)}\n`)
      break
    default: out(`unknown command ${name}. Type :help\n`)
  }
  return true
}
