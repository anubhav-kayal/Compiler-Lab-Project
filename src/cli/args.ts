export type Command = 'translate' | 'run' | 'check' | 'repl' | 'bench' | 'examples' | 'help' | 'version'

export type Options = {
  command: Command
  mode: 'auto' | 'expression' | 'program'
  optimize: boolean
  compare: boolean
  tokens: boolean
  tree: boolean
  stats: boolean
  run: boolean
  json: boolean
  color: boolean | undefined
  inputs: Record<string, number>
  example?: string
  output?: string
  target?: string
}

const commands: Command[] = ['translate', 'run', 'check', 'repl', 'bench', 'examples', 'help', 'version']

export class UsageError extends Error {}

export function parseArgs(argv: string[]): Options {
  const options: Options = {
    command: 'translate', mode: 'auto', optimize: false, compare: false, tokens: false, tree: false,
    stats: false, run: false, json: false, color: undefined, inputs: {},
  }
  const rest: string[] = []
  let sawCommand = false
  const value = (flag: string, i: number) => {
    if (i + 1 >= argv.length) throw new UsageError(`${flag} needs a value.`)
    return argv[i + 1]
  }
  const expanded = argv.flatMap(arg => /^-[A-Za-z]{2,}$/.test(arg) && [...arg.slice(1)].every(letter => 'pecOtTsrj'.includes(letter)) ? [...arg.slice(1)].map(letter => `-${letter}`) : [arg])
  argv = expanded
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--') { rest.push(...argv.slice(i + 1)); break }
    if (arg === '-h' || arg === '--help') options.command = 'help'
    else if (arg === '-v' || arg === '--version') options.command = 'version'
    else if (arg === '-p' || arg === '--program') options.mode = 'program'
    else if (arg === '-e' || arg === '--expr') options.mode = 'expression'
    else if (arg === '-O' || arg === '--optimize') options.optimize = true
    else if (arg === '-c' || arg === '--compare') options.compare = true
    else if (arg === '-t' || arg === '--tokens') options.tokens = true
    else if (arg === '-T' || arg === '--tree') options.tree = true
    else if (arg === '-s' || arg === '--stats') options.stats = true
    else if (arg === '-r' || arg === '--run') options.run = true
    else if (arg === '-j' || arg === '--json') options.json = true
    else if (arg === '--no-color') options.color = false
    else if (arg === '--color') options.color = true
    else if (arg === '--set') { addInputs(options, value(arg, i)); i++ }
    else if (arg === '--example') { options.example = value(arg, i); i++ }
    else if (arg === '-o' || arg === '--output') { options.output = value(arg, i); i++ }
    else if (arg.startsWith('--set=')) addInputs(options, arg.slice(6))
    else if (arg.startsWith('--example=')) options.example = arg.slice(10)
    else if (arg.startsWith('--output=')) options.output = arg.slice(9)
    else if (arg.startsWith('-') && arg !== '-' && !/^-\d/.test(arg)) throw new UsageError(`Unknown option ${arg}. Try “sdt --help”.`)
    else if (!sawCommand && rest.length === 0 && (commands as string[]).includes(arg)) { options.command = arg as Command; sawCommand = true }
    else rest.push(arg)
  }
  if (options.command === 'run') options.run = true
  if (rest.length) options.target = rest.join(' ')
  return options
}

function addInputs(options: Options, text: string) {
  for (const pair of text.split(',').filter(Boolean)) {
    const match = /^([A-Za-z_]\w*)=(-?\d+|true|false)$/.exec(pair.trim())
    if (!match) throw new UsageError(`Bad --set value “${pair}”. Use name=integer, for example --set n=5,x=-2.`)
    options.inputs[match[1]] = match[2] === 'true' ? 1 : match[2] === 'false' ? 0 : Number(match[2])
  }
}
