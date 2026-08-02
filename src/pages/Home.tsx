import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { LanguageToggle } from '@/components/LanguageToggle'

export default function Home() {
  const { t } = useI18n()
  const { guest } = useAuth()
  const [credits, setCredits] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    void supabase.rpc('my_credits_remaining').then(({ data }) => {
      if (!cancelled && typeof data === 'number') setCredits(data)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="px-6 py-8">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-sm text-ink-faint">{t('home.hello')}</p>
          <h1 className="mt-1 text-3xl">{guest?.display_name}</h1>
        </div>
        <LanguageToggle />
      </header>

      <Link
        to="/camera"
        className="mt-8 flex items-center justify-between rounded-card bg-ink px-5 py-5 text-paper-raised"
      >
        <span>
          <span className="block text-lg">{t('camera.title')}</span>
          <span className="mt-0.5 block text-sm opacity-70">
            {credits === null ? ' ' : t('camera.creditsLeft', { n: credits })}
          </span>
        </span>
        <span aria-hidden className="text-2xl">
          ○
        </span>
      </Link>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <Link to="/bingo" className="rounded-card border border-rule bg-paper-raised p-5">
          <span className="block">{t('bingo.title')}</span>
          <span className="mt-1 block text-sm text-ink-faint">{t('home.bingoHint')}</span>
        </Link>
        <Link to="/program" className="rounded-card border border-rule bg-paper-raised p-5">
          <span className="block">{t('program.title')}</span>
          <span className="mt-1 block text-sm text-ink-faint">26–28.09</span>
        </Link>
      </div>

      <Link
        to="/me"
        className="mt-4 block rounded-card border border-rule bg-paper-raised p-5 text-sm text-ink-muted"
      >
        {t('me.title')}
      </Link>
    </div>
  )
}
