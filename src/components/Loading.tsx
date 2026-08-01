import { useI18n } from '@/i18n'

export function Loading() {
  const { t } = useI18n()
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <p className="text-sm text-ink-faint">{t('app.loading')}</p>
    </div>
  )
}
