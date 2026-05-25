'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import * as XLSX from 'xlsx'

// Импорт переводов
import ru from '../locales/ru.json'
import en from '../locales/en.json'
import kk from '../locales/kk.json'

const translations = { ru, en, kk }
type Lang = 'ru' | 'en' | 'kk'

// --- Типизация ---
interface WialonSensor {
  id: number
  n: string
  t: string
  p: string
  tbl?: Array<{ x: number; a: number; b: number }>
}

interface ChartPoint {
  time: string
  fullDisplay: string
  level: number
  discharge: number
  rawDate: string
}

interface WialonMessage {
  t: number
  p?: Record<string, number | string | undefined>
}

const Map = dynamic(() => import('../components/Map'), {
  ssr: false,
  loading: () => <div className="h-80 bg-slate-800 animate-pulse rounded-4xl" />,
})

export default function WaterReportPage() {
  const [hasRendered, setHasRendered] = useState(false)
  const [chartData, setChartData] = useState<ChartPoint[]>([])
  const [lastUpdate, setLastUpdate] = useState('')

  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lang') as Lang
      return saved && translations[saved] ? saved : 'ru'
    }
    return 'ru'
  })

  const t = translations[lang].report

  const [mapPos, setMapPos] = useState<[number, number]>([43.2425, 76.9592])
  const [unitName, setUnitName] = useState(t.loading)

  const [fromDate, setFromDate] = useState(new Date(new Date().setHours(0, 0, 0, 0)).toISOString().slice(0, 16))
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 16))
  const [isLoading, setIsLoading] = useState(false)

  // Инициализируем коэффициенты из LocalStorage, если они там есть
  const [coeffA, setCoeffA] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('coeff_a') || '2.876315103'
    }
    return '0.857410584'
  })

  const [coeffB, setCoeffB] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('coeff_b') || '3.081393'
    }
    return '2.096947'
  })

  // Используем useRef для стабильного доступа внутри интервалов автообновления
  const coeffsRef = useRef({ a: coeffA, b: coeffB })

  // Синхронизируем рефы и сохраняем значения в LocalStorage при каждом изменении
  useEffect(() => {
    coeffsRef.current = { a: coeffA, b: coeffB }
    localStorage.setItem('coeff_a', coeffA)
    localStorage.setItem('coeff_b', coeffB)
  }, [coeffA, coeffB])

  const fetchHistoryData = useCallback(
    async (isAutoUpdate = false) => {
      try {
        if (!isAutoUpdate) setIsLoading(true)

        const loginRes = await fetch('/api/wialon', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ svc: 'token/login', params: {} }),
        })
        const { eid } = await loginRes.json()
        if (!eid) return

        const unitRes = await fetch('/api/wialon', {
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
        const unitData = await unitRes.json()

        let targetSensor: WialonSensor | null = null
        let currentUnitId: number | null = null

        if (unitData.items && unitData.items[0]) {
          const unit = unitData.items[0]
          currentUnitId = unit.id

          if (unit.pos) {
            setMapPos([unit.pos.y, unit.pos.x])
          }
          setUnitName(unit.nm)

          const sensors = Object.values(unit.sens || {}) as WialonSensor[]
          targetSensor = sensors.find((s) => s.n === 'Уровень' || s.t === 'level') || null
        }

        if (!currentUnitId) return

        const fromTimestamp = Math.floor(new Date(fromDate).getTime() / 1000)
        const toTimestamp = Math.floor(new Date(toDate).getTime() / 1000)

        const msgRes = await fetch('/api/wialon', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            svc: 'messages/load_interval',
            params: {
              itemId: currentUnitId,
              timeFrom: fromTimestamp,
              timeTo: toTimestamp,
              flags: 0,
              flagsMask: 0,
              loadCount: 5000,
            },
            sid: eid,
          }),
        })

        const data = await msgRes.json()
        const messages: WialonMessage[] = data.messages || []

        const numA = parseFloat(coeffsRef.current.a.replace(',', '.')) || 0
        const numB = parseFloat(coeffsRef.current.b.replace(',', '.')) || 0

        const formattedData: ChartPoint[] = messages.map((m) => {
          const dateObj = new Date(m.t * 1000)
          const paramName = targetSensor?.p || 'rs485fuel_level1'
          const rawValue = Number(m.p?.[paramName]) || 0

          let levelInCm = 0
          if (targetSensor?.tbl && targetSensor.tbl.length > 0) {
            const tbl = [...targetSensor.tbl].sort((a, b) => b.x - a.x)
            const row = tbl.find((r) => rawValue >= r.x) || tbl[tbl.length - 1]
            levelInCm = row.a * rawValue + row.b
          } else {
            levelInCm = 0.0348 * rawValue
          }

          const H = levelInCm / 100
          const validH = H > 0 ? H : 0
          const Q = numA * validH + numB * Math.pow(validH, 2)

          return {
            time: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            fullDisplay: dateObj.toLocaleString([], {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            }),
            level: parseFloat(levelInCm.toFixed(2)),
            discharge: parseFloat(Q.toFixed(4)),
            rawDate: dateObj.toLocaleString(),
          }
        })

        setChartData(formattedData)
        setLastUpdate(new Date().toLocaleTimeString())
      } catch (e) {
        console.error('Data error:', e)
      } finally {
        setIsLoading(false)
      }
    },
    [fromDate, toDate],
  )

  const dailyStats = useMemo(() => {
    const groups: Record<string, { totalLevel: number; totalQ: number; count: number }> = {}
    chartData.forEach((point) => {
      const day = point.rawDate.split(',')[0]
      if (!groups[day]) groups[day] = { totalLevel: 0, totalQ: 0, count: 0 }
      groups[day].totalLevel += point.level
      groups[day].totalQ += point.discharge
      groups[day].count += 1
    })
    return Object.entries(groups).map(([date, data]) => ({
      date,
      avgLevel: (data.totalLevel / data.count).toFixed(2),
      avgQ: (data.totalQ / data.count).toFixed(4),
    }))
  }, [chartData])

  const exportToExcel = () => {
    if (chartData.length === 0) return
    const workbook = XLSX.utils.book_new()
    const summaryRows = [
      [t.tableDate, t.tableAvgLevel, t.tableAvgQ],
      ...dailyStats.map((s) => [s.date, s.avgLevel, s.avgQ]),
    ]
    const detailRows = [
      [`${t.tableDate} & ${t.updated}`, t.chartLevel, t.chartDischarge],
      ...chartData.map((c) => [c.rawDate, c.level, c.discharge]),
    ]
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([[t.excelSummary], ...summaryRows]), t.sheetSummary)
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([[t.excelDetails], ...detailRows]), t.sheetDetails)
    XLSX.writeFile(workbook, `Water_Report_${lang}_${new Date().toLocaleDateString()}.xlsx`)
  }

  useEffect(() => {
    setHasRendered(true)
    fetchHistoryData()
  }, [fetchHistoryData])

  useEffect(() => {
    const interval = setInterval(() => {
      fetchHistoryData(true)
    }, 60000)
    return () => clearInterval(interval)
  }, [fetchHistoryData])

  if (!hasRendered) return <div className="min-h-screen bg-[#0f172a]" />

  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-4 md:p-8 font-sans">
      {/* Языковой переключатель */}
      <div className="fixed top-4 right-4 z-50 flex gap-1 bg-slate-900/90 p-1 rounded-xl border border-white/10 backdrop-blur-md">
        {(['ru', 'en', 'kk'] as Lang[]).map((l) => (
          <button
            key={l}
            onClick={() => {
              setLang(l)
              localStorage.setItem('lang', l)
            }}
            className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
              lang === l ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}>
            {l}
          </button>
        ))}
      </div>

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Панель фильтров */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div className="relative">
              <label className="text-blue-400 text-[10px] mb-2 uppercase font-bold block">{t.coeffA}</label>
              <input
                type="text"
                value={coeffA}
                onChange={(e) => setCoeffA(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:ring-1 focus:ring-blue-500 transition-all"
              />
            </div>
            <div className="relative">
              <label className="text-blue-400 text-[10px] mb-2 uppercase font-bold block">{t.coeffB}</label>
              <input
                type="text"
                value={coeffB}
                onChange={(e) => setCoeffB(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:ring-1 focus:ring-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="text-slate-400 text-[10px] mb-2 uppercase font-bold block">{t.start}</label>
              <input
                type="datetime-local"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-xs"
              />
            </div>
            <div>
              <label className="text-slate-400 text-[10px] mb-2 uppercase font-bold block">{t.end}</label>
              <input
                type="datetime-local"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-xs"
              />
            </div>
            <button
              onClick={() => fetchHistoryData()}
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-bold transition-all active:scale-95">
              {isLoading ? '...' : t.showBtn}
            </button>
          </div>
        </div>

        {/* Заголовок и кнопки */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-2xl font-bold uppercase">{unitName}</h1>
            <p className="text-slate-500 text-sm">
              Q = {coeffA}·H + {coeffB}·H² | {t.updated}: {lastUpdate}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={exportToExcel}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-medium transition-all">
              {t.excel}
            </button>
            <button
              onClick={() => window.print()}
              className="bg-red-600 hover:bg-red-500 text-white px-5 py-2.5 rounded-xl font-medium transition-all">
              {t.pdf}
            </button>
          </div>
        </div>

        {/* График */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-4xl p-6 h-96">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="fullDisplay" stroke="#64748b" fontSize={10} minTickGap={45} />
              <YAxis yAxisId="left" stroke="#3b82f6" fontSize={12} unit={` ${t.unitCm}`} />
              <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={12} unit={` ${t.unitM3}`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px' }}
              />
              <Area
                yAxisId="left"
                type="monotone"
                name={t.chartLevel}
                dataKey="level"
                stroke="#3b82f6"
                fillOpacity={0.1}
                fill="#3b82f6"
                strokeWidth={3}
              />
              <Area
                yAxisId="right"
                type="monotone"
                name={t.chartDischarge}
                dataKey="discharge"
                stroke="#10b981"
                fillOpacity={0.1}
                fill="#10b981"
                strokeWidth={3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Таблица */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500 uppercase text-[10px] font-bold border-b border-slate-800 bg-slate-900/40">
              <tr>
                <th className="px-6 py-4">{t.tableDate}</th>
                <th className="px-6 py-4 text-blue-400">{t.tableAvgLevel}</th>
                <th className="px-6 py-4 text-emerald-400">{t.tableAvgQ}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {dailyStats.map((s, i) => (
                <tr key={i} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-6 py-4">{s.date}</td>
                  <td className="px-6 py-4 font-bold">{s.avgLevel}</td>
                  <td className="px-6 py-4 font-mono">{s.avgQ}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* КАРТА */}
        <div className="rounded-4xl overflow-hidden border border-slate-800 h-80 shadow-2xl">
          <Map key={mapPos.join(',')} pos={mapPos} name={unitName} />
        </div>
      </div>
    </div>
  )
}
