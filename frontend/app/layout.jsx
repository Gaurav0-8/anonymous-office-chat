import { GoogleOAuthProvider } from '@react-oauth/google';
import { ThemeProvider } from '@/context/ThemeContext';
import InstallPrompt from '@/components/InstallPrompt';
import './globals.css';

export const metadata = {
  title: 'ChatApp',
  description: 'Anonymous real-time chat application. Connect and chat with privacy.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ChatApp',
  },
  icons: {
    icon: '/icons/icon-512x512.png',
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport = {
  themeColor: '#6366f1',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}>
          <ThemeProvider>
            {children}
            <InstallPrompt />
          </ThemeProvider>
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}
