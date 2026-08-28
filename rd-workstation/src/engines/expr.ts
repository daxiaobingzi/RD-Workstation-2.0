/* ================= 轻量表达式求值：ceil(camera_count/24) 等 ================= */
const FUNCS: Record<string, (...a: number[]) => number> = {
  ceil: Math.ceil, floor: Math.floor, round: Math.round,
  max: Math.max, min: Math.min, abs: Math.abs, sqrt: Math.sqrt,
}

function tokenize(expr: string): string[] {
  const tokens: string[] = []
  let i = 0
  const src = expr.replace(/\s+/g, '')
  while (i < src.length) {
    const c = src[i]
    if (/[0-9.]/.test(c)) {
      let j = i
      while (j < src.length && /[0-9.]/.test(src[j])) j++
      tokens.push(src.slice(i, j)); i = j; continue
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i
      while (j < src.length && /[a-zA-Z0-9_]/.test(src[j])) j++
      tokens.push(src.slice(i, j)); i = j; continue
    }
    if ('+-*/%^(),'.includes(c)) { tokens.push(c); i++; continue }
    i++
  }
  return tokens
}

export function evalExpr(expr: string, vars: Record<string, number>): number {
  const toks = tokenize(expr)
  const out: (string | number)[] = []
  const ops: string[] = []
  const prec: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 3 }
  const applyOp = () => {
    const op = ops.pop()!
    if (op === ',') return
    if (op in FUNCS) {
      const args: number[] = []
      while (out.length && typeof out[out.length - 1] === 'number') args.unshift(out.pop() as number)
      out.push(FUNCS[op](...args))
      return
    }
    const b = out.pop() as number
    const a = out.pop() as number
    switch (op) {
      case '+': out.push(a + b); break
      case '-': out.push(a - b); break
      case '*': out.push(a * b); break
      case '/': out.push(a / b); break
      case '%': out.push(a % b); break
      case '^': out.push(Math.pow(a, b)); break
    }
  }
  for (const t of toks) {
    if (t === '(') { ops.push(t); continue }
    if (t === ')') {
      while (ops.length && ops[ops.length - 1] !== '(') applyOp()
      ops.pop()
      if (ops.length && ops[ops.length - 1] in FUNCS) applyOp()
      continue
    }
    if (t === ',') {
      while (ops.length && ops[ops.length - 1] !== '(') applyOp()
      continue
    }
    if (t in prec) {
      while (ops.length && ops[ops.length - 1] !== '(' && (prec[ops[ops.length - 1]] ?? 0) >= prec[t]) applyOp()
      ops.push(t); continue
    }
    if (/^-?\d+(\.\d+)?$/.test(t)) { out.push(parseFloat(t)); continue }
    if (t in vars) { out.push(vars[t]); continue }
    if (t in FUNCS) { ops.push(t); continue }
    out.push(0)
  }
  while (ops.length) applyOp()
  return out.length ? (out.pop() as number) : 0
}

/* ================= 条件规则求值：camera_count > 0 && cnt_indoor >= 12 ================= */
export function evalCondition(cond: string | undefined, vars: Record<string, number>): boolean {
  if (!cond || !cond.trim()) return true
  for (const raw of cond.split('&&')) {
    const m = raw.trim().match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*(>=|<=|!=|==|>|<)\s*([-0-9.]+)$/)
    if (!m) continue
    const left = vars[m[1]] ?? 0
    const right = parseFloat(m[3])
    const pass =
      m[2] === '>=' ? left >= right : m[2] === '<=' ? left <= right : m[2] === '!=' ? left !== right
        : m[2] === '==' ? left === right : m[2] === '>' ? left > right : left < right
    if (!pass) return false
  }
  return true
}