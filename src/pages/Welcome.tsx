import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { useAuth } from '@/lib/auth'
import type { RedeemError } from '@/lib/auth'
import { LanguageToggle } from '@/components/LanguageToggle'
import { Loading } from '@/components/Loading'
import type { StringKey } from '@/i18n/strings'

const ERROR_KEY: Record<RedeemError, StringKey> = {
  invalid_code: 'welcome.invalidCode',
  code_already_used: 'welcome.codeUsed',
  too_many_attempts: 'welcome.tooManyAttempts',
  offline: 'welcome.offline',
  unknown: 'welcome.unknown',
}

export function Welcome() {
  const { t } = useI18n()
  const { status, redeem } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const codeFromQr = params.get('c') ?? ''
  const [code, setCode] = useState(codeFromQr)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<RedeemError | null>(null)
  const autoTried = useRef(false)
  // Redeeming flips status to 'redeemed', which would otherwise trip the
  // "already signed in" redirect below and skip the confirmation screen.
  const redeeming = useRef(false)

  async function submit(value: string) {
    setBusy(true)
    setError(null)
    redeeming.current = true
    const result = await redeem(value)
    setBusy(false)
    if (result.ok) {
      // Always the confirmation screen. Deliberately not "wherever they were
      // heading": React Router keeps that in history.state, which survives
      // reloads, so a stale value from an earlier visit sends guests to a
      // random screen and skips the confirmation entirely.
      navigate('/join', { replace: true })
    } else {
      redeeming.current = false
      setError(result.reason)
    }
  }

  // A QR scan should just work — no typing, no extra tap.
  useEffect(() => {
    if (status !== 'anonymous' || !codeFromQr || autoTried.current) return
    autoTried.current = true
    void submit(codeFromQr)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, codeFromQr])

  if (status === 'loading') return <Loading />
  // A returning guest lands straight on the hub; one mid-redeem goes to /join.
  if (status === 'redeemed' && !redeeming.current) {
    return <Navigate to="/home" replace />
  }

  return (
    <div className="flex min-h-dvh flex-col px-6 py-8">
      <header className="flex justify-end">
        <LanguageToggle />
      </header>

      <div className="flex flex-1 flex-col justify-center">
        <h1 className="text-4xl">{t('welcome.title')}</h1>
        <p className="mt-3 text-ink-muted">{t('welcome.subtitle')}</p>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submit(code)
          }}
          className="mt-8"
        >
          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value)
              setError(null)
            }}
            placeholder={t('welcome.codePlaceholder')}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            maxLength={8}
            disabled={busy}
            aria-invalid={error !== null}
            className="w-full rounded-card border border-rule bg-paper-raised px-4 py-3.5 text-center text-2xl tracking-[0.3em] outline-none placeholder:text-base placeholder:tracking-normal focus:border-sage disabled:opacity-50 aria-[invalid=true]:border-danger"
          />

          {error && (
            <p role="alert" className="mt-3 text-center text-sm text-danger">
              {t(ERROR_KEY[error])}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || code.trim().length === 0}
            className="mt-4 w-full rounded-card bg-ink py-3.5 text-paper-raised transition-opacity disabled:opacity-30"
          >
            {busy ? t('app.loading') : t('welcome.submit')}
          </button>
        </form>
      </div>

      <footer className="pt-8 text-center">
        <Link to="/program" className="text-sm text-ink-muted underline underline-offset-4">
          {t('welcome.viewProgram')}
        </Link>
      </footer>
    </div>
  )
}
