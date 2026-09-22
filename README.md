# SDT Lab — Syntax-Directed Translation

An interactive compiler laboratory for translating arithmetic and Boolean expressions into labeled three-address code. The app makes every stage visible: tokens, an annotated parse tree, semantic attributes, diagnostics, and intermediate instructions.

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite. The compiler is also available from the terminal:

```bash
npm run translate -- "x < y && y != 0"
npm test
npm run build
```

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

## Architecture

- `src/compiler/lexer.ts` tokenizes the source and reports invalid characters.
- `src/compiler/parser.ts` builds the precedence-aware parse tree.
- `src/compiler/translator.ts` performs type checking and syntax-directed code generation.
- `src/compiler/api.ts` exposes a small request/response adapter for a local HTTP layer.
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
5. What changes would be needed to translate assignment statements?

## Repository

The intended public repository is `syntax-directed-translation-compiler-lab`. Commits are authored with the project owner's configured Git identity.
