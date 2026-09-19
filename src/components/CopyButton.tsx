import { useState } from 'react'
import { useI18n } from '@/i18n'

/**
 * Copy an address to the clipboard.
 *
 * Worth having because the most common thing a guest does with an address in
 * Guizhou is hand it to a taxi driver — and retyping Chinese characters from a
 * screen, on a phone, is miserable.
 */
export function CopyButton({ text, className = '' }: { text: string; className?: string }) {
  const { t } = useI18n()
  const [done, setDone] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Older iOS Safari, or a non-secure context: fall back to a hidden
      // textarea, which still works where the async API is unavailable.
      const el = document.createElement('textarea')
      el.value = text
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      try {
        document.execCommand('copy')
      } catch {
        return
      } finally {
        el.remove()
      }
    }
    setDone(true)
    setTimeout(() => setDone(false), 1800)
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className={`shrink-0 rounded-full border border-rule px-2.5 py-1 text-xs text-ink-muted transition-colors active:bg-paper-sunk ${className}`}
    >
      {done ? t('app.copied') : t('app.copy')}
    </button>
  )
}
