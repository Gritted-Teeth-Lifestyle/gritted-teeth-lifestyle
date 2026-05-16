import './globals.css'
import { IOSPWAKeyboardFix } from './ios-pwa-keyboard-fix'
import PredictiveTapChainGuard from '../components/PredictiveTapChainGuard'
import PredictiveTapDebugOverlay from '../components/PredictiveTapDebugOverlay'

export const metadata = {
  title: 'Gritted Teeth Lifestyle',
  description: 'Track your diet and build your fitness',
  appleWebApp: {
    capable: true,
    title: 'GTL',
    statusBarStyle: 'black-translucent',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <IOSPWAKeyboardFix />
        <PredictiveTapChainGuard />
        <PredictiveTapDebugOverlay />
      </body>
    </html>
  )
}
