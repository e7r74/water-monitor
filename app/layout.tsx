import type { Metadata } from 'next'
import { Inter } from 'next/font/google' // Импортируем Inter
import './globals.css'

// Настраиваем шрифт Inter
const inter = Inter({
  subsets: ['latin', 'cyrillic'], // Обязательно добавляем cyrillic для русского/казахского
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: {
    default: 'Water-Monitoring Dashboard | Мониторинг уровня воды',
    template: '%s | Water-Monitor', // Позволяет страницам иметь заголовки типа "Графики | Water-Monitor"
  },
  description:
    'Профессиональная система мониторинга уровня воды в реальном времени. Отслеживание датчиков, аналитика и уведомления.',
  keywords: ['мониторинг воды', 'уровень воды', 'IoT датчики', 'Water-Monitoring', 'контроль воды'],
  authors: [{ name: 'Ваше Имя/Команда' }],

  // Настройка для соцсетей (Facebook, VK, WhatsApp)
  openGraph: {
    title: 'Water-Monitoring Dashboard',
    description: 'Система контроля и мониторинга уровня воды в реальном времени',
    url: 'https://vash-sait.ru',
    siteName: 'Water-Monitor',
    locale: 'ru_RU',
    type: 'website',
  },

  // Настройка для Twitter
  twitter: {
    card: 'summary_large_image',
    title: 'Water-Monitoring Dashboard',
    description: 'Система контроля уровня воды',
  },

  // Иконки (favicons)
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
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
