'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Компонент для плавного слежения за объектом
function Recenter({ pos }: { pos: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    if (pos && pos[0] !== 0) {
      // flyTo — это магия, которая заставит карту следовать за маркером
      map.flyTo(pos, map.getZoom(), {
        animate: true,
        duration: 1.5,
      })
    }
  }, [pos, map])
  return null
}

interface MapProps {
  pos: [number, number]
  name: string
}

export default function Map({ pos, name }: MapProps) {
  useEffect(() => {
    // Настраиваем иконки только один раз на клиенте
    // @ts-expect-error: internal leaflet property access
    delete L.Icon.Default.prototype._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    })
  }, [])

  // Создаем иконку. Поскольку ssr: false, L всегда определен здесь.
  const customIcon = L.divIcon({
    html: `
      <div style="display: flex; flex-direction: column; align-items: center;">
        <div style="width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-bottom: 16px solid #ef4444;"></div>
        <div style="background: white; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: bold; color: #ef4444; border: 2px solid #ef4444; margin-top: 4px; white-space: nowrap; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
          ${name}
        </div>
      </div>
    `,
    className: '',
    iconSize: [30, 50],
    iconAnchor: [15, 16],
  })

  return (
    <div className="h-full w-full min-h-[400px] relative">
      <MapContainer
        center={pos}
        zoom={15}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%', borderRadius: '1.5rem', zIndex: 1 }}>
        <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {/* Этот компонент «двигает» карту вслед за новыми координатами */}
        <Recenter pos={pos} />

        <Marker position={pos} icon={customIcon}>
          <Popup>
            <div className="text-center font-bold">{name}</div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  )
}