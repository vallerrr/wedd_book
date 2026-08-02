import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { I18nProvider } from '@/i18n'
import { AuthProvider } from '@/lib/auth'
import { WeChatGuard } from '@/components/WeChatGuard'
import { GuestLayout } from '@/components/GuestLayout'
import { RequireGuest } from '@/components/RequireGuest'
import { Loading } from '@/components/Loading'
import { Welcome } from '@/pages/Welcome'
import { Program } from '@/pages/Program'

// Guest screens beyond the entry point are split out so the first paint stays small.
const Join = lazy(() => import('@/pages/Join'))
const Home = lazy(() => import('@/pages/Home'))
const Camera = lazy(() => import('@/pages/Camera'))
const Bingo = lazy(() => import('@/pages/Bingo'))
const BingoQuestion = lazy(() => import('@/pages/BingoQuestion'))
const Gallery = lazy(() => import('@/pages/Gallery'))
const Me = lazy(() => import('@/pages/Me'))

// The whole admin panel is one lazy chunk — guests never download it.
const AdminApp = lazy(() => import('@/admin/AdminApp'))

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<Loading />}>
            <Routes>
              {/* Public — no invite code, readable in WeChat, works offline */}
              <Route path="/program" element={<Program />} />

              <Route
                element={
                  <WeChatGuard>
                    <GuestLayout />
                  </WeChatGuard>
                }
              >
                {/* Entry point: redeeming happens here */}
                <Route path="/" element={<Welcome />} />

                {/* Everything past this needs a redeemed invite code */}
                <Route element={<RequireGuest />}>
                  <Route path="/join" element={<Join />} />
                  <Route path="/home" element={<Home />} />
                  <Route path="/camera" element={<Camera />} />
                  <Route path="/bingo" element={<Bingo />} />
                  <Route path="/bingo/:position" element={<BingoQuestion />} />
                  <Route path="/gallery" element={<Gallery />} />
                  <Route path="/me" element={<Me />} />
                </Route>
              </Route>

              <Route path="/admin/*" element={<AdminApp />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  )
}
