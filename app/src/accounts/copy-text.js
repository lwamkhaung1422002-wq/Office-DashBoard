export async function copyText(text, environment = globalThis) {
  try {
    if (environment.navigator?.clipboard?.writeText) {
      await environment.navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to the selectable textarea fallback.
  }

  const document = environment.document
  if (!document?.body || typeof document.execCommand !== 'function') return false
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  textarea.setSelectionRange?.(0, textarea.value.length)
  try {
    return document.execCommand('copy') === true
  } catch {
    return false
  } finally {
    textarea.remove()
  }
}
