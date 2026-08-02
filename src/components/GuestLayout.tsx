import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useI18n } from '@/i18n'
import type { StringKey } from '@/i18n/strings'

// Routes before the guest has an identity get no chrome.
const BARE_ROUTES = new Set(['/', '/join'])

const TABS: { to: string; key: StringKey; icon: string }[] = [
  { to: '/home', key: 'nav.home', icon: 'M3 10.5 12 3l9 7.5V21H3z' },
  {
    to: '/camera',
    key: 'nav.camera',
    icon: 'M3 7h4l2-2h6l2 2h4v12H3zM12 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  },
  { to: '/bingo', key: 'nav.bingo', icon: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z' },
  { to: '/program', key: 'nav.program', icon: 'M5 4h14v16H5zM8 8h8M8 12h8M8 16h5' },
  { to: '/gallery', key: 'nav.gallery', icon: 'M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6' },
]

export function GuestLayout() {
  const { t } = useI18n()
  const { pathname } = useLocation()
  const bare = BARE_ROUTES.has(pathname)

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <main className={`flex-1 ${bare ? '' : 'pb-24'}`}>
        <Outlet />
      </main>

      {!bare && (
        <nav className="safe-bottom fixed inset-x-0 bottom-0 mx-auto max-w-lg border-t border-rule bg-paper/95 pt-2 backdrop-blur">
          <ul className="flex justify-around">
            {TABS.map((tab) => (
              <li key={tab.to}>
                <NavLink
                  to={tab.to}
                  className={({ isActive }) =>
                    `flex min-w-16 flex-col items-center gap-1 rounded-card px-2 py-1 text-[11px] transition-colors ${
                      isActive ? 'text-sage' : 'text-ink-faint'
                    }`
                  }
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d={tab.icon} />
                  </svg>
                  {t(tab.key)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  )
}
