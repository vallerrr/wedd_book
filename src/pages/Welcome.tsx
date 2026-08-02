import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { LanguageToggle } from '@/components/LanguageToggle'

export function Welcome() {
  const { t } = useI18n()
  const [params] = useSearchParams()
  // QR codes carry ?c=abc so most guests never type anything.
  const [code, setCode] = useState(params.get('c') ?? '')

  // Phase 1 wires this to signInAnonymously() + rpc('redeem_invite_code').
  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
  }

  return (
    <div className="flex min-h-dvh flex-col px-6 py-8">
      <header className="flex justify-end">
        <LanguageToggle />
      </header>

      <div className="flex flex-1 flex-col justify-center">
        <h1 className="text-4xl">{t('welcome.title')}</h1>
        <p className="mt-3 text-ink-muted">{t('welcome.subtitle')}</p>

        <form onSubmit={onSubmit} className="mt-8">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t('welcome.codePlaceholder')}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={8}
            className="w-full rounded-card border border-rule bg-paper-raised px-4 py-3.5 text-center text-2xl tracking-[0.3em] outline-none placeholder:text-base placeholder:tracking-normal focus:border-sage"
          />
          <button
            type="submit"
            disabled={code.trim().length === 0}
            className="mt-4 w-full rounded-card bg-ink py-3.5 text-paper-raised disabled:opacity-30"
          >
            {t('welcome.submit')}
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
