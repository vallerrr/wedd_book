import { useI18n } from '@/i18n'

/** Stub — built in a later phase. See the plan's build-phase table. */
export default function Gallery() {
  const { t } = useI18n()
  return (
    <div className="px-6 py-8">
      <h1 className="text-2xl">Gallery</h1>
      <p className="mt-2 text-sm text-ink-faint">{t('app.loading')}</p>
    </div>
  )
}
