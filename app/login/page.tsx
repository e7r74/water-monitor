'use client'

import React, { useState, useSyncExternalStore, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Импорт языковых файлов
import ru from '../locales/ru.json'
import en from '../locales/en.json'
import kk from '../locales/kk.json'

const translations = { ru, en, kk }
const subscribe = () => () => {}

type Lang = 'ru' | 'en' | 'kk'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('app_lang') as Lang
      return saved && translations[saved] ? saved : 'ru'
    }
    return 'ru'
  })
  const router = useRouter()

  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )

  // Достаем переводы для текущего языка
  const t = translations[lang].login

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (username === 'admin' && password === '12345') {
      localStorage.setItem('isLoggedIn', 'true')
      localStorage.setItem('app_lang', lang) // Сохраняем язык для всей сессии
      router.push('/')
    } else {
      setError(t.error)
    }
  }

  const changeLang = (newLang: Lang) => {
    setLang(newLang)
    localStorage.setItem('app_lang', newLang)
    setError('') // Сбрасываем ошибку при смене языка
  }

  if (!isClient) return <div className="min-h-screen bg-[#020617]" />

  return (
    <div className="relative min-h-screen bg-[#020617] flex items-center justify-center p-6 overflow-hidden">
      {/* Кнопки переключения языка */}
      <div className="fixed top-4 right-4 z-50 flex gap-1 bg-slate-900/90 p-1 rounded-xl border border-white/10 backdrop-blur-md">
        {(['ru', 'en', 'kk'] as Lang[]).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => changeLang(l)}
            className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all border ${
              lang === l
                ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/40'
                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:border-white/20'
            }`}>
            {l}
          </button>
        ))}
      </div>

      {/* Глубокий фон с бликами */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/10 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-blue-800/5 blur-[150px] animate-pulse [animation-duration:8s]" />

        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-slate-900/60 backdrop-blur-3xl p-10 rounded-[2.5rem] border border-white/10 shadow-2xl">
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1.5 h-8 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
              <h1 className="text-2xl font-bold text-white tracking-tighter uppercase">
                {t.title} <span className="text-blue-500">{t.subtitle}</span>
              </h1>
            </div>
            <p className="text-slate-400 text-sm font-medium leading-relaxed">{t.desc}</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-slate-500 text-[10px] uppercase tracking-[0.2em] font-bold ml-1">
                {t.idLabel}
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-slate-700"
                placeholder={t.idPlaceholder}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-slate-500 text-[10px] uppercase tracking-[0.2em] font-bold ml-1">
                {t.passLabel}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-slate-700"
                placeholder={t.passPlaceholder}
              />
            </div>

            {error && (
              <div className="flex items-center gap-3 text-red-400 text-xs bg-red-500/10 border border-red-500/20 p-4 rounded-2xl">
                <div className="w-1 h-1 rounded-full bg-red-500 animate-ping" />
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-bold text-white transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98] uppercase text-[11px] tracking-widest">
              {t.loginBtn}
            </button>
          </form>

          <div className="mt-10 pt-6 border-t border-white/5 flex justify-between items-center opacity-50">
            <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Encrypted Node</span>
            <span className="text-[9px] text-blue-500 font-bold uppercase tracking-widest">Secure Access</span>
          </div>
        </div>
      </div>
    </div>
  )
}
