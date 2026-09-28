import { parse, type Expression, type Statement } from 'acorn'

/**
 * The exec bridge can print arbitrary model-authored text. Treat its output
 * as web evidence only when the program prints an unmodified web-tool result.
 */
export function isVerbatimWebProgram(code: string): boolean {
  if (code.length > 128 * 1024) return false
  const bindings = new Set<string>()
  let prints = 0
  function literal(expression: Expression): boolean {
    if (expression.type === 'Literal') return !(expression.value instanceof RegExp)
    if (expression.type === 'ArrayExpression') return expression.elements.every(item => item !== null && item.type !== 'SpreadElement' && literal(item))
    if (expression.type === 'ObjectExpression') return expression.properties.every(property => property.type === 'Property' && property.kind === 'init' && !property.method && !property.computed && literal(property.value as Expression))
    if (expression.type === 'UnaryExpression' && expression.operator === '-' && expression.argument.type === 'Literal') return typeof expression.argument.value === 'number'
    return false
  }
  function webResult(expression: Expression): boolean {
    if (expression.type !== 'AwaitExpression' || expression.argument.type !== 'CallExpression') return false
    const call = expression.argument
    return call.callee.type === 'MemberExpression' && !call.callee.computed
      && call.callee.object.type === 'Identifier' && call.callee.object.name === 'tools'
      && call.callee.property.type === 'Identifier' && call.callee.property.name === 'web__run'
      && call.arguments.length === 1 && call.arguments[0]?.type !== 'SpreadElement'
      && literal(call.arguments[0]!)
  }
  function statement(node: Statement): boolean {
    if (node.type === 'EmptyStatement') return true
    if (node.type === 'VariableDeclaration') {
      if (node.kind !== 'const') return false
      for (const declaration of node.declarations) {
        if (declaration.id.type !== 'Identifier' || !declaration.init || bindings.has(declaration.id.name) || !webResult(declaration.init)) return false
        bindings.add(declaration.id.name)
      }
      return true
    }
    if (node.type !== 'ExpressionStatement' || node.expression.type !== 'CallExpression') return false
    const call = node.expression
    if (call.callee.type !== 'Identifier' || call.callee.name !== 'text' || call.arguments.length !== 1) return false
    const argument = call.arguments[0]!
    if (argument.type === 'SpreadElement') return false
    if (!webResult(argument) && !(argument.type === 'Identifier' && bindings.has(argument.name))) return false
    prints += 1
    return true
  }
  try {
    const program = parse(code, { ecmaVersion: 'latest', sourceType: 'script', allowAwaitOutsideFunction: true })
    return program.body.every(node => statement(node as Statement)) && prints > 0
  } catch { return false }
}
