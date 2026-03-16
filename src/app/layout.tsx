import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Bitcoin City - Build Your Tower Based on Your BTC Holdings',
  description: 'A 3D city where every citizen is a building. The more BTC you hold, the taller your tower rises.',
  keywords: ['bitcoin', 'btc', 'city', '3d', 'crypto', 'holdings', 'visualization'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
