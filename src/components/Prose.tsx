import type { ReactNode } from 'react'

/**
 * Renders the small slice of Markdown the couple actually writes: paragraphs,
 * bullet lists, **bold** and *italic*.
 *
 * Deliberately not a Markdown library. This is on the public itinerary, which
 * is the one page guests load before they have any cached assets, so every
 * kilobyte counts — and it renders to React elements rather than raw HTML, so
 * there is no dangerouslySetInnerHTML and no XSS surface at all.
 */

function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = []
  // Split on **bold** and *italic*, keeping the delimiters as capture groups.
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)

  parts.forEach((part, i) => {
    if (!part) return
    const key = `${keyPrefix}-${i}`
    if (part.startsWith('**') && part.endsWith('**')) {
      out.push(
        <strong key={key} className="font-medium">
          {part.slice(2, -2)}
        </strong>,
      )
    } else if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      out.push(<em key={key}>{part.slice(1, -1)}</em>)
    } else {
      out.push(part)
    }
  })

  return out
}

export function Prose({ text, className = '' }: { text: string | null; className?: string }) {
  if (!text?.trim()) return null

  const blocks = text.trim().split(/\n{2,}/)

  return (
    <div className={`space-y-3 leading-relaxed ${className}`}>
      {blocks.map((block, bi) => {
        const lines = block.split('\n')

        if (lines.every((l) => l.trim().startsWith('- '))) {
          return (
            <ul key={bi} className="space-y-1.5">
              {lines.map((line, li) => (
                <li key={li} className="flex gap-2.5">
                  <span aria-hidden className="text-ink-faint">
                    ·
                  </span>
                  <span>{inline(line.trim().slice(2), `${bi}-${li}`)}</span>
                </li>
              ))}
            </ul>
          )
        }

        // Single newlines inside a paragraph stay as line breaks.
        return (
          <p key={bi}>
            {lines.map((line, li) => (
              <span key={li}>
                {li > 0 && <br />}
                {inline(line, `${bi}-${li}`)}
              </span>
            ))}
          </p>
        )
      })}
    </div>
  )
}
