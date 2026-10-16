# SDT Lab — Syntax-Directed Translation

An interactive compiler laboratory for translating arithmetic and Boolean expressions into labeled three-address code. The app makes every stage visible: tokens, an annotated parse tree, semantic attributes, diagnostics, and intermediate instructions.

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite. The compiler is also available as a command line tool, `sdt` (see below).

```bash
npm test
npm run build
```

## Command line tool

```bash
npm link                      # optional: puts `sdt` on your PATH; otherwise use `node bin/sdt.mjs`
sdt "x < y && y != 0"
sdt -pOc "a = 2 * 3; while (a < 20) a = a + 4;"   # program, optimized, original next to optimized
sdt run --example gcd --set a=48,b=18             # translate and execute
sdt check prog.txt                                # diagnostics only, exit code 0 or 1
echo "a + b * c" | sdt -T                         # read stdin, print the annotated tree
sdt repl                                          # interactive session
sdt bench                                         # optimizer results on the built-in programs
sdt --help
```

Subcommands: `translate` (default), `run`, `check`, `repl`, `bench`, `examples`. Options: `-O` optimize, `-c` compare, `-t` tokens, `-T` tree, `-s` stats, `-r` run, `--set k=v`, `--example name`, `-o file`, `-j` JSON, `-e`/`-p` force expression or program mode, `--no-color`. Exit codes: 0 success, 1 source errors, 2 bad command line. Errors are printed with the source line and a caret.

## Supported grammar

```text
Expr           → Or
Or             → And ( "||" And )*
And            → Equality ( "&&" Equality )*
Equality       → Relational ( ("==" | "!=") Relational )*
Relational     → Additive ( ("<" | "<=" | ">" | ">=") Additive )*
Additive       → Multiplicative ( ("+" | "-") Multiplicative )*
Multiplicative → Unary ( ("*" | "/" | "%") Unary )*
Unary          → "!" Unary | "-" Unary | Primary
Primary        → identifier | integer | true | false | "(" Expr ")"
```

Arithmetic operators synthesize a temporary place. Boolean operators use inherited true and false labels, preserving short-circuit evaluation. A Boolean expression used as a value is materialized as `0` or `1` between labels.

## Statements

Programs add assignment, `if`/`else`, `while` and `{ }` blocks on top of the expression grammar.

```text
Program   → Stmt*
Stmt      → identifier "=" Expr ";"
          | "if" "(" Expr ")" Stmt ( "else" Stmt )?
          | "while" "(" Expr ")" Stmt
          | "{" Stmt* "}"
```

Conditions are compiled with inherited true and false labels, so `&&` and `||` short-circuit inside `if` and `while`. A variable takes the type of its first assignment (`int` or `bool`). Reading a variable before any assignment gives a warning and treats it as an integer input.

## Optimizer

`src/compiler/optimize.ts` repeats these passes until nothing changes: constant propagation for single-definition temporaries, constant folding (division by zero is left alone), merging `t = a op b; x = t` into `x = a op b`, branch inversion, jump threading, removal of jumps to the next line, unreachable code and unused labels. `src/compiler/interpret.ts` runs three-address code. Integers are 32-bit two's complement in both the folder and the interpreter, so folding at compile time matches running the code. The tests check that every built-in program, and 1000 seeded random programs from `src/compiler/fuzz.ts`, give the same variables before and after optimizing.

## Architecture

- `src/compiler/lexer.ts` tokenizes the source and reports invalid characters.
- `src/compiler/parser.ts` builds the precedence-aware parse tree.
- `src/compiler/translator.ts` performs type checking and syntax-directed code generation.
- `src/compiler/api.ts` exposes a small request/response adapter for a local HTTP layer.
- `src/compiler/program.ts`, `optimize.ts`, `interpret.ts` handle statements, optimization and execution.
- `src/cli/` and `bin/sdt.mjs` hold the command line tool.
- `src/App.tsx` renders the compiler laboratory interface using the same core module.

The public compiler entry point is:

```ts
import { translate } from './src/compiler'
const result = translate('a + b * c')
```

## Sample output

For `x < y && y != 0`, the output uses conditional jumps and labels similar to:

```text
if x < y goto L2
goto L1
L2:
if y != 0 goto L0
goto L1
L0:
t0 = 1
goto L3
L1:
t0 = 0
L3:
```

## Lab discussion

1. Why does the Boolean translation use labels instead of immediately creating a temporary?
2. How does the `&&` translation avoid evaluating its right operand when the left operand is false?
3. Which attributes are synthesized and which are inherited?
4. How does the parser encode precedence without ambiguity?
5. Why is it safe to replace a temporary that has a single definition by its constant value, but not a program variable inside a loop?

## Repository

https://github.com/anubhav-kayal/Compiler-Lab-Project
