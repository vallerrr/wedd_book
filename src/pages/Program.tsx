import { Link } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { LanguageToggle } from '@/components/LanguageToggle'

/**
 * Public three-day itinerary — no invite code, readable in WeChat, and
 * precached by the service worker so hotel addresses survive a dead signal.
 *
 * Phase 2 fills this from program_days / program_items / content_blocks and
 * seeds the couple's real content.
 */
export function Program() {
  const { t } = useI18n()

  return (
    <div className="mx-auto w-full max-w-lg px-6 py-8">
      <header className="flex items-center justify-between">
        <Link to="/" className="text-sm text-ink-muted">
          ← {t('app.name')}
        </Link>
        <LanguageToggle />
      </header>

      <h1 className="mt-8 text-3xl">{t('program.title')}</h1>
      <p className="mt-2 text-sm text-ink-faint">26–28 September 2026 · 贵阳 · 黔西</p>
    </div>
  )
}
