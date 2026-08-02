import { useI18n } from '@/i18n'
import { useAuth } from '@/lib/auth'

export default function Me() {
  const { t, locale, setLocale } = useI18n()
  const { guest, updatePrefs, signOut } = useAuth()

  if (!guest) return null

  return (
    <div className="px-6 py-8">
      <h1 className="text-3xl">{t('me.title')}</h1>

      <dl className="mt-8 divide-y divide-rule border-y border-rule">
        <div className="flex items-center justify-between py-4">
          <dt className="text-ink-muted">{t('me.name')}</dt>
          <dd>{guest.display_name}</dd>
        </div>

        {guest.table_number && (
          <div className="flex items-center justify-between py-4">
            <dt className="text-ink-muted">{t('me.table')}</dt>
            <dd>{guest.table_number}</dd>
          </div>
        )}

        <label className="flex items-center justify-between gap-4 py-4">
          <span className="text-ink-muted">{t('me.anonymousDefault')}</span>
          <input
            type="checkbox"
            checked={guest.default_anonymous}
            onChange={(e) => void updatePrefs({ default_anonymous: e.target.checked })}
            className="h-5 w-5 shrink-0 accent-sage"
          />
        </label>

        <div className="flex items-center justify-between py-4">
          <span className="text-ink-muted">{t('me.language')}</span>
          <div className="flex gap-1 rounded-full border border-rule p-0.5">
            {(['zh', 'en'] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => {
                  setLocale(l)
                  void updatePrefs({ locale: l })
                }}
                className={`rounded-full px-3 py-1 text-sm ${
                  locale === l ? 'bg-ink text-paper-raised' : 'text-ink-muted'
                }`}
              >
                {l === 'zh' ? '中文' : 'EN'}
              </button>
            ))}
          </div>
        </div>
      </dl>

      <button
        type="button"
        onClick={() => void signOut()}
        className="mt-8 text-sm text-ink-faint underline underline-offset-4"
      >
        {t('me.signOut')}
      </button>
    </div>
  )
}
