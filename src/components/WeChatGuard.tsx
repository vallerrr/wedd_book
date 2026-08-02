import { Link } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { isWeChatBrowser } from '@/lib/ua'

/**
 * Full-screen interstitial for gated routes opened inside WeChat.
 * Wraps children; renders them untouched in any supported browser.
 */
export function WeChatGuard({ children }: { children: React.ReactNode }) {
  const { t } = useI18n()

  if (!isWeChatBrowser()) return <>{children}</>

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-8 text-center">
      {/* Points at the ··· menu WeChat puts in the top-right corner */}
      <div className="absolute top-3 right-5 text-2xl text-ink-faint" aria-hidden>
        ↗
      </div>

      <h1 className="text-2xl">{t('wechat.title')}</h1>
      <p className="max-w-sm text-balance text-ink-muted leading-relaxed">{t('wechat.body')}</p>

      <div className="mt-2 border-t border-rule pt-6">
        <p className="mb-3 text-sm text-ink-faint">{t('wechat.programOnly')}</p>
        <Link
          to="/program"
          className="inline-block rounded-card bg-sage px-5 py-2.5 text-paper-raised"
        >
          {t('wechat.viewProgram')}
        </Link>
      </div>
    </div>
  )
}
