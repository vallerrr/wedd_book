import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { useAuth } from '@/lib/auth'
import { LanguageToggle } from '@/components/LanguageToggle'
import { Prose } from '@/components/Prose'
import { fetchProgramme, readCachedProgramme } from '@/lib/programme'
import type { ContentBlock, ProgramItem, Programme } from '@/lib/programme'

/** Blocks shown above the day tabs, in this order. The rest go below. */
const INTRO_KEYS = ['trip_intro', 'covered', 'not_covered']

function dayLabel(iso: string, locale: string) {
  const d = new Date(`${iso}T00:00:00+08:00`)
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Shanghai',
  }).format(d)
}

function Item({ item }: { item: ProgramItem }) {
  const { t, pick } = useI18n()
  const title = pick(item.title_zh, item.title_en)
  const time = pick(item.time_label_zh, item.time_label_en)
  const body = pick(item.body_zh, item.body_en)

  return (
    <li className="border-t border-rule py-6 first:border-t-0 first:pt-0">
      {time && <p className="text-xs tracking-wide text-ink-faint uppercase">{time}</p>}
      <h3 className="mt-1 text-xl">{title}</h3>

      {item.image_paths.length > 0 && (
        <div className="mt-4 flex gap-3 overflow-x-auto">
          {item.image_paths.map((src) => (
            <img
              key={src}
              src={src}
              alt=""
              loading="lazy"
              className="h-44 w-auto shrink-0 rounded-card object-cover"
            />
          ))}
        </div>
      )}

      <Prose text={body} className="mt-3 text-ink-muted" />

      {(item.location_name || item.address) && (
        <div className="mt-4 rounded-card bg-paper-sunk px-4 py-3 text-sm">
          {item.location_name && <p>{item.location_name}</p>}
          {item.address && <p className="mt-0.5 text-ink-muted">{item.address}</p>}
          {item.map_url && (
            <a
              href={item.map_url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-sage underline underline-offset-4"
            >
              {t('program.openMap')} →
            </a>
          )}
        </div>
      )}
    </li>
  )
}

function Block({ block }: { block: ContentBlock }) {
  const { pick } = useI18n()
  const title = pick(block.title_zh, block.title_en)
  const body = pick(block.body_zh, block.body_en)
  return (
    <section className="mt-8">
      {title && <h2 className="text-lg">{title}</h2>}
      <Prose text={body} className="mt-2 text-ink-muted" />
    </section>
  )
}

/**
 * Public three-day itinerary. No invite code, readable in WeChat, and cached
 * so hotel addresses survive a dead signal on the road to Qianxi.
 */
export function Program() {
  const { t, locale, pick } = useI18n()
  const { status } = useAuth()
  const [data, setData] = useState<Programme | null>(readCachedProgramme)
  const [failed, setFailed] = useState(false)
  const [activeDay, setActiveDay] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchProgramme()
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [])

  const days = data?.days ?? []
  const current = activeDay ?? days[0]?.day_date ?? null

  const itemsForDay = useMemo(() => {
    if (!data || !current) return []
    const day = data.days.find((d) => d.day_date === current)
    if (!day) return []
    return data.items.filter((i) => i.day_id === day.id && i.visible)
  }, [data, current])

  const blocks = data?.blocks.filter((b) => b.visible) ?? []
  const intro = INTRO_KEYS.map((k) => blocks.find((b) => b.key === k)).filter(
    Boolean,
  ) as ContentBlock[]
  const outro = blocks.filter((b) => !INTRO_KEYS.includes(b.key))
  const day = days.find((d) => d.day_date === current)

  return (
    <div className="mx-auto w-full max-w-lg px-6 py-8">
      <header className="flex items-center justify-between">
        <Link to={status === 'redeemed' ? '/home' : '/'} className="text-sm text-ink-muted">
          ← {t('app.name')}
        </Link>
        <LanguageToggle />
      </header>

      <h1 className="mt-8 text-3xl">{t('program.title')}</h1>
      <p className="mt-1 text-sm text-ink-faint">26–28.09.2026 · 贵阳 · 黔西</p>

      {!data && !failed && <p className="mt-10 text-sm text-ink-faint">{t('app.loading')}</p>}
      {!data && failed && <p className="mt-10 text-sm text-ink-faint">{t('app.offline')}</p>}

      {data && (
        <>
          {intro.map((b) => (
            <Block key={b.key} block={b} />
          ))}

          {/* Sticky so the day you're on stays reachable while scrolling. */}
          <nav className="sticky top-0 -mx-6 mt-10 bg-paper/95 px-6 py-3 backdrop-blur">
            <ul className="flex gap-2">
              {days.map((d, i) => {
                const on = d.day_date === current
                return (
                  <li key={d.id} className="flex-1">
                    <button
                      type="button"
                      onClick={() => setActiveDay(d.day_date)}
                      aria-current={on ? 'true' : undefined}
                      className={`w-full rounded-card border px-2 py-2 text-center text-sm transition-colors ${
                        on
                          ? 'border-ink bg-ink text-paper-raised'
                          : 'border-rule text-ink-muted hover:bg-paper-sunk'
                      }`}
                    >
                      <span className="block">{t('program.day', { n: i + 1 })}</span>
                      <span className="block text-xs opacity-70">
                        {dayLabel(d.day_date, locale)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>

          {day && (
            <div className="mt-6">
              <h2 className="text-xl">{pick(day.label_zh, day.label_en)}</h2>
              <Prose
                text={pick(day.intro_zh, day.intro_en)}
                className="mt-1 text-sm text-ink-faint"
              />
            </div>
          )}

          {itemsForDay.length > 0 ? (
            <ul className="mt-6">
              {itemsForDay.map((item) => (
                <Item key={item.id} item={item} />
              ))}
            </ul>
          ) : (
            // Reachable before the content is seeded, or if a day is emptied.
            // Better than a page that just stops.
            <p className="mt-8 text-sm text-ink-faint">{t('program.empty')}</p>
          )}

          {outro.map((b) => (
            <Block key={b.key} block={b} />
          ))}
        </>
      )}
    </div>
  )
}
