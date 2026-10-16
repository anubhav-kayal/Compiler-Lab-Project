import { translateProgram } from './program'
import { translate } from './translator'

export function translateRequest(body: unknown) {
  if (!body || typeof body !== 'object' || !('source' in body) || typeof body.source !== 'string') {
    return { status: 400, body: { success: false, diagnostics: [{ message: 'Request body must contain a string field named source.' }] } }
  }
  const mode = 'mode' in body && body.mode === 'program' ? 'program' : 'expression'
  return { status: 200, body: mode === 'program' ? translateProgram(body.source) : translate(body.source) }
}
