import type { Metadata } from 'next'
import { Inter } from 'next/font/google' // Импортируем Inter
import './globals.css'

// Настраиваем шрифт Inter
const inter = Inter({
  subsets: ['latin', 'cyrillic'], // Обязательно добавляем cyrillic для русского/казахского
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Water-Monitoring Dashboard',
  description: 'Система мониторинга уровня воды',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru">
      <body className={`${inter.variable} font-sans antialiased`}>{children}</body>
    </html>
  )
}
