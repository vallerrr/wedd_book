import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { strings } from './strings'
import type { Locale, StringKey } from './strings'

const STORAGE_KEY = 'wb.locale'

type I18nValue = {
  locale: Locale
  setLocale: (next: Locale) => void
  toggle: () => void
  /** Look up a string, substituting {placeholders}. */
  t: (key: StringKey, vars?: Record<string, string | number>) => string
  /** Pick the right half of a bilingual DB column pair. */
  pick: <T>(zh: T, en: T) => T
}

const I18nContext = createContext<I18nValue | null>(null)

function initialLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'zh' || stored === 'en') return stored
  // Most guests are Chinese speakers; default there unless the browser says otherwise.
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, locale)
    // Drives the :lang() rules that swap the display face for Chinese.
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en'
  }, [locale])

  const setLocale = useCallback((next: Locale) => setLocaleState(next), [])
  const toggle = useCallback(() => setLocaleState((l) => (l === 'zh' ? 'en' : 'zh')), [])

  const t = useCallback(
    (key: StringKey, vars?: Record<string, string | number>) => {
      let out: string = strings[locale][key] ?? strings.zh[key] ?? key
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          out = out.replaceAll(`{${k}}`, String(v))
        }
      }
      return out
    },
    [locale],
  )

  const pick = useCallback(<T,>(zh: T, en: T): T => (locale === 'zh' ? zh : en), [locale])

  const value = useMemo(
    () => ({ locale, setLocale, toggle, t, pick }),
    [locale, setLocale, toggle, t, pick],
  )

  return <I18nContext value={value}>{children}</I18nContext>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>')
  return ctx
}
