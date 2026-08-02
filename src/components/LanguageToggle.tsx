import { useI18n } from '@/i18n'

export function LanguageToggle({ className = '' }: { className?: string }) {
  const { t, toggle } = useI18n()
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t('lang.label')}
      className={`rounded-full border border-rule px-3 py-1 text-xs tracking-wide text-ink-muted transition-colors hover:bg-paper-sunk ${className}`}
    >
      {t('lang.toggle')}
    </button>
  )
}
