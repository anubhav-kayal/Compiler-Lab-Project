import { useMemo, useState } from 'react'
import { translate } from './compiler'
import type { AnnotatedNode, TranslationResult } from './compiler'

const examples = [
  { label: 'Arithmetic precedence', value: 'a + b * (c - 2)' },
  { label: 'Short-circuit AND', value: 'x < y && y != 0' },
  { label: 'Boolean negation', value: '!(a >= b || flag)' },
  { label: 'Type error', value: 'true + 2' },
]

function TreeNode({ node, depth = 0 }: { node: AnnotatedNode; depth?: number }) {
  const [open, setOpen] = useState(depth < 2)
  return <div className="tree-node">
    <button className="tree-row" onClick={() => setOpen(!open)} aria-expanded={open}>
      <span className="caret">{node.children.length ? (open ? '⌄' : '›') : '·'}</span>
      <span className="node-kind">{node.kind}</span>
      {node.value && <code>{node.value}</code>}
      <span className={`type-pill ${node.type}`}>{node.type}</span>
    </button>
    {open && <div className="tree-children">
      {node.children.map(child => <TreeNode key={child.id} node={child} depth={depth + 1} />)}
      <div className="attributes">
        {node.place && <span>place = <b>{node.place}</b></span>}
        {node.trueLabel && <span>true = <b>{node.trueLabel}</b></span>}
        {node.falseLabel && <span>false = <b>{node.falseLabel}</b></span>}
      </div>
    </div>}
  </div>
}

function App() {
  const [source, setSource] = useState(examples[0].value)
  const [selectedExample, setSelectedExample] = useState(examples[0].label)
  const result: TranslationResult = useMemo(() => translate(source), [source])
  const error = result.diagnostics.find(d => d.severity === 'error')
  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">λ</span><span>SDT <em>lab</em></span></div>
      <div className="top-meta"><span className="status-dot" /> recursive descent · three-address code</div>
    </header>
    <section className="hero">
      <div className="eyebrow">Compiler laboratory / 01</div>
      <h1>Make the syntax<br /><i>do the work.</i></h1>
      <p>Trace an expression from tokens to an annotated tree, then watch semantic actions assemble its intermediate code.</p>
    </section>
    <section className="workspace">
      <div className="input-card panel">
        <div className="panel-heading"><span>01 / expression</span><span className="hint">Try an example</span></div>
        <textarea value={source} onChange={event => setSource(event.target.value)} aria-label="Expression input" spellCheck={false} />
        <div className="example-strip">{examples.map(example => <button key={example.label} className={selectedExample === example.label ? 'active' : ''} onClick={() => { setSource(example.value); setSelectedExample(example.label) }}>{example.label}</button>)}</div>
        <div className="grammar-note"><span>GRAMMAR</span> Expr → Or → And → Equality → Relational → Additive → Multiplicative → Unary → Primary</div>
      </div>
      <div className="summary-row">
        <div className="stat panel"><b>{result.tokens.filter(token => token.kind !== 'eof').length}</b><span>tokens</span></div>
        <div className="stat panel"><b>{result.tree ? countNodes(result.tree) : '—'}</b><span>tree nodes</span></div>
        <div className="stat panel"><b>{result.instructions.length || '—'}</b><span>instructions</span></div>
        <div className={`compile-state panel ${result.success ? 'ok' : 'bad'}`}><span>{result.success ? '●' : '×'}</span><b>{result.success ? 'translated' : 'needs attention'}</b></div>
      </div>
      <div className="results-grid">
        <section className="panel tree-panel"><div className="panel-heading"><span>02 / annotated tree</span><span className="legend">type · attributes</span></div>{result.tree ? <div className="tree-view"><TreeNode node={result.tree} /></div> : <EmptyState text="A valid tree will appear here." />}</section>
        <section className="panel code-panel"><div className="panel-heading"><span>03 / intermediate code</span><span className="legend">TAC / labeled</span></div>{result.formattedCode ? <pre className="code-view">{result.formattedCode.split('\n').map((line, index) => <div key={index}><span className="line-no">{String(index + 1).padStart(2, '0')}</span><span className={line.endsWith(':') ? 'label-line' : line.startsWith('if') ? 'branch-line' : ''}>{line}</span></div>)}</pre> : <EmptyState text="Generate code by fixing the expression." />}</section>
      </div>
      <section className={`diagnostics panel ${error ? 'has-error' : ''}`}><div className="panel-heading"><span>04 / diagnostics</span><span>{error ? 'semantic or syntax error' : 'all checks passed'}</span></div>{error ? <p><strong>!</strong> {error.message} <small>characters {error.start}–{error.end}</small></p> : <p><strong>✓</strong> Types are compatible and semantic actions are ready to emit code.</p>}</section>
    </section>
    <footer><span>SYNTAX-DIRECTED TRANSLATION</span><span>Arithmetic + Boolean + relational expressions</span><span>lab build 1.0</span></footer>
  </main>
}

function countNodes(node: AnnotatedNode): number { return 1 + node.children.reduce((total, child) => total + countNodes(child), 0) }
function EmptyState({ text }: { text: string }) { return <div className="empty-state">{text}</div> }

export default App
