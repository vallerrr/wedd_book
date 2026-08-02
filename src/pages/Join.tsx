import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { useAuth } from '@/lib/auth'
import { LanguageToggle } from '@/components/LanguageToggle'
import { Loading } from '@/components/Loading'

/**
 * First screen after redeeming. Because the admin sets display_name up front,
 * this is a confirmation rather than a form — the guest just checks it's them
 * and picks whether their photos are named or anonymous by default.
 */
export default function Join() {
  const { t, locale } = useI18n()
  const { status, guest, updatePrefs, signOut } = useAuth()
  const navigate = useNavigate()
  const [anonymous, setAnonymous] = useState(false)

  if (status === 'loading') return <Loading />
  if (status === 'anonymous') return <Navigate to="/" replace />

  async function confirm() {
    await updatePrefs({ default_anonymous: anonymous, locale })
    navigate('/home', { replace: true })
  }

  return (
    <div className="flex min-h-dvh flex-col px-6 py-8">
      <header className="flex justify-end">
        <LanguageToggle />
      </header>

      <div className="flex flex-1 flex-col justify-center">
        <p className="text-ink-muted">{t('join.confirm')}</p>
        <h1 className="mt-2 text-4xl">{t('join.greeting', { name: guest.display_name })}</h1>

        <label className="mt-10 flex items-start gap-3 rounded-card border border-rule bg-paper-raised p-4">
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-sage"
          />
          <span>
            <span className="block">{t('me.anonymousDefault')}</span>
            <span className="mt-1 block text-sm text-ink-faint">{t('join.anonymousHint')}</span>
          </span>
        </label>

        <button
          type="button"
          onClick={() => void confirm()}
          className="mt-6 w-full rounded-card bg-ink py-3.5 text-paper-raised"
        >
          {t('join.yes')}
        </button>

        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-3 w-full py-2 text-sm text-ink-muted underline underline-offset-4"
        >
          {t('join.no')}
        </button>
      </div>
    </div>
  )
}
