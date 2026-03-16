'use client'

import React, { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// Ключ OpenWeather
const WEATHER_API_KEY = '88d591a394d7aec06486bad31ebc63a0'

// --- Подключение ваших JSON переводов ---
const locales = {
  ru: {
    logout: 'Выйти',
    currentLevel: 'Текущий уровень',
    cm: 'см',
    updated: 'Обновлено',
    weatherLoading: 'Загрузка погоды...',
    wind: 'Ветер',
    ms: 'м/с',
    pressure: 'Давление',
    mm: 'мм',
    goToReport: 'Перейти к отчету',
    loading: 'Загрузка...',
  },
  kk: {
    logout: 'Шығу',
    currentLevel: 'Ағымдағы деңгей',
    cm: 'см',
    updated: 'Жаңартылды',
    weatherLoading: 'Ауа райы жүктелуде...',
    wind: 'Жел',
    ms: 'м/с',
    pressure: 'Қысым',
    mm: 'мм',
    goToReport: 'Есепке өту',
    loading: 'Жүктелуде...',
  },
  en: {
    logout: 'Logout',
    currentLevel: 'Current Level',
    cm: 'cm',
    updated: 'Updated',
    weatherLoading: 'Loading weather...',
    wind: 'Wind',
    ms: 'm/s',
    pressure: 'Pressure',
    mm: 'mm',
    goToReport: 'Go to report',
    loading: 'Loading...',
  },
}

type Lang = 'ru' | 'kk' | 'en'

interface WialonSensor {
  id: number
  n: string
  t: string
  p: string
  tbl?: Array<{ x: number; a: number; b: number }>
}

interface WialonUnit {
  nm: string
  sens: Record<string, WialonSensor>
  pvs?: Record<string, { v: number; t: number }>
  lmsg?: { p?: Record<string, number> }
  pos?: { x: number; y: number }
}

interface WeatherData {
  temp: number
  description: string
  icon: string
  windSpeed: number
  pressure: number
}

const Map = dynamic(() => import('./components/Map'), {
  ssr: false,
  loading: () => <div className="h-100 bg-slate-800 animate-pulse rounded-3xl" />,
})

export default function Dashboard() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [isAuth, setIsAuth] = useState(false)
  const [weather, setWeather] = useState<WeatherData | null>(null)

  // Состояние языка (берем из localStorage или по умолчанию 'ru')
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('lang') as Lang) || 'ru'
    }
    return 'ru'
  })

  const t = locales[lang]

  const [sensorData, setSensorData] = useState({
    name: '',
    level: 0,
    lat: 43.2425,
    lng: 76.9592,
    lastUpdate: '',
  })

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn')
    setIsAuth(false)
    router.push('/login')
  }

  const changeLanguage = (newLang: Lang) => {
    setLang(newLang)
    localStorage.setItem('lang', newLang)
  }

  const fetchWeather = async (lat: number, lon: number, currentLang: Lang) => {
    try {
      const apiLang = currentLang === 'kk' ? 'kz' : currentLang
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${WEATHER_API_KEY}&units=metric&lang=${apiLang}`,
      )
      const data = await res.json()
      if (data.main) {
        setWeather({
          temp: Math.round(data.main.temp),
          description: data.weather[0].description,
          icon: data.weather[0].icon,
          windSpeed: data.wind.speed,
          pressure: Math.round(data.main.pressure * 0.75),
        })
      }
    } catch (e) {
      console.error('Weather error:', e)
    }
  }

  const updateData = useCallback(async () => {
    try {
      const loginRes = await fetch('/api/wialon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ svc: 'token/login', params: {} }),
      })

      const loginData = await loginRes.json()
      const eid = loginData.eid
      if (!eid) return

      const dataRes = await fetch('/api/wialon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          svc: 'core/search_items',
          params: {
            spec: { itemsType: 'avl_unit', propName: 'sys_name', propValueMask: '*', sortType: 'sys_name' },
            force: 1,
            flags: 1 + 1024 + 4096,
            from: 0,
            to: 0,
          },
          sid: eid,
        }),
      })

      const result = await dataRes.json()

      if (result.items && result.items[0]) {
        const unit = result.items[0] as WialonUnit
        let waterLevel = 0

        const sensors = Object.values(unit.sens || {}) as WialonSensor[]
        const fuelSensor = sensors.find((s) => s.n === 'Уровень' || s.t === 'level')

        if (fuelSensor) {
          const sensorId = fuelSensor.id.toString()
          const rawValue = unit.lmsg?.p?.[fuelSensor.p] || 0

          if (unit.pvs && unit.pvs[sensorId]) {
            waterLevel = unit.pvs[sensorId].v
          } else if (fuelSensor.tbl && fuelSensor.tbl.length > 0) {
            const tbl = [...fuelSensor.tbl].sort((a, b) => b.x - a.x)
            const row = tbl.find((r) => rawValue >= r.x) || tbl[tbl.length - 1]
            waterLevel = row.a * rawValue + row.b
          } else {
            waterLevel = rawValue
          }
        }

        const newLat = unit.pos?.y || 43.2425
        const newLng = unit.pos?.x || 76.9592

        fetchWeather(newLat, newLng, lang)

        setSensorData({
          name: unit.nm,
          level: parseFloat(Number(waterLevel).toFixed(2)),
          lat: newLat,
          lng: newLng,
          lastUpdate: new Date().toLocaleTimeString(),
        })
      }
    } catch (error) {
      console.error('Ошибка в updateData:', error)
    }
  }, [lang])

  useEffect(() => {
    const loggedIn = localStorage.getItem('isLoggedIn') === 'true'

    const init = async () => {
      setMounted(true)
      if (loggedIn) {
        setIsAuth(true)
        await updateData()
      } else {
        router.push('/login')
      }
    }

    init()

    let interval: NodeJS.Timeout
    if (loggedIn) {
      interval = setInterval(updateData, 30000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [router, updateData])

  if (!mounted || !isAuth) {
    return <div className="min-h-screen bg-slate-900" />
  }

  return (
    <main className="min-h-screen bg-slate-900 text-white p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold text-slate-400 uppercase tracking-widest">
            <span className="text-slate-200 ml-4">Water-Monitoring</span>
          </h1>

          <div className="flex items-center gap-4">
            {/* Переключатель языков на основе ваших файлов */}
            <div className=" top-4 right-4 z-50 flex gap-1 bg-slate-900/90 p-1 rounded-xl border border-white/10 backdrop-blur-md">
              {(['ru', 'kk', 'en'] as Lang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => changeLanguage(l)}
                  className={`px-2 py-1 text-xs rounded-md transition-all ${
                    lang === l ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>

            <button
              onClick={handleLogout}
              className="bg-slate-800 hover:bg-red-900/40 text-slate-300 px-4 py-2 rounded-xl border border-slate-700 transition-all text-sm">
              {t.logout}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 bg-slate-800 rounded-4xl p-8 border border-slate-700 shadow-2xl flex flex-col md:flex-row justify-between items-center">
            <div className="text-center md:text-left">
              <span className="text-sm text-slate-500 uppercase tracking-tighter">{t.currentLevel}</span>
              <div className="flex items-baseline gap-2">
                <span className="text-7xl font-black text-blue-500">{sensorData.level}</span>
                <span className="text-2xl text-slate-500 font-light">{t.cm}</span>
              </div>
            </div>
            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-700 text-center mt-4 md:mt-0">
              <p className="text-[10px] text-slate-500 uppercase mb-2">{t.updated}</p>
              <p className="text-xl font-mono text-blue-300">{sensorData.lastUpdate || '--:--:--'}</p>
            </div>
          </div>

          <div className="bg-slate-800 rounded-4xl p-6 border border-slate-700 shadow-2xl flex flex-col items-center">
            {weather ? (
              <>
                <div className="flex items-center gap-2">
                  <img
                    src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`}
                    alt="weather"
                    className="w-16 h-16"
                  />
                  <div className="text-4xl font-bold text-orange-400">{weather.temp}°C</div>
                </div>
                <div className="text-xs text-slate-400 uppercase font-medium mb-4 capitalize">
                  {weather.description}
                </div>
                <div className="w-full grid grid-cols-2 gap-2 border-t border-slate-700 pt-4">
                  <div className="text-center">
                    <p className="text-[10px] text-slate-500 uppercase">{t.wind}</p>
                    <p className="text-sm font-semibold text-blue-300">
                      {weather.windSpeed} {t.ms}
                    </p>
                  </div>
                  <div className="text-center border-l border-slate-700">
                    <p className="text-[10px] text-slate-500 uppercase">{t.pressure}</p>
                    <p className="text-sm font-semibold text-blue-300">
                      {weather.pressure} {t.mm}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-slate-600 animate-pulse text-sm uppercase">{t.weatherLoading}</div>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-4xl border border-slate-700 shadow-2xl">
          <Map pos={[sensorData.lat, sensorData.lng]} name={sensorData.name || t.loading} />
        </div>

        <Link
          href="/water-report"
          className="inline-block bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl transition-all font-medium shadow-lg shadow-blue-900/20 active:scale-95">
          {t.goToReport}
        </Link>
      </div>
    </main>
  )
}
