'use client';

import React, { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import GeoTIFFViewer from './GeoTIFFViewer';
import LegendControl from './LegendControl';

const MapView = ({ selectedT, latestTime, setCoords, isRasterVisible, opacity, selectedYear, onMapClick }) => {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const [initialized, setInitialized] = useState(false);

  // Inicializar el mapa solo una vez
  useEffect(() => {
    if (typeof window === 'undefined' || initialized) return;

    // Crear el mapa de Leaflet con vista inicial
    const mapInstance = L.map(mapContainer.current).setView([-30.5, -71.0], 8);

    // Añadir capa base
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(mapInstance);

    // Manejar clics en el mapa
    mapInstance.on('click', (e) => {
      const { lat, lng } = e.latlng;
      setCoords({ lat, lng });
      if (onMapClick) {
        onMapClick({ lat, lng });
      }
    });

    mapRef.current = mapInstance;
    setInitialized(true);

    return () => {
      mapInstance.remove();
    };
  }, [initialized, setCoords, onMapClick]);

  // Cargar la capa WMS según selectedT y latestTime
  useEffect(() => {
    if (!mapRef.current) return;

    let wmsLayer = null;

    if (selectedT === '5' && latestTime) {
      wmsLayer = L.tileLayer.wms('https://ows.globalfloods.eu/glofas-ows/ows.py', {
        layers: 'sumALHEGE',
        format: 'image/png',
        time: latestTime,
        transparent: true,
        version: '1.3.0',
        attribution: 'Globalfloods.eu',
      }).addTo(mapRef.current);
    } else if (selectedT === '20' && latestTime) {
      wmsLayer = L.tileLayer.wms('https://ows.globalfloods.eu/glofas-ows/ows.py', {
        layers: 'sumALEEGE',
        format: 'image/png',
        time: latestTime,
        transparent: true,
        version: '1.3.0',
        attribution: 'Globalfloods.eu',
      }).addTo(mapRef.current);
    }

    return () => {
      if (wmsLayer) {
        mapRef.current.removeLayer(wmsLayer);
      }
    };
  }, [selectedT, latestTime]);

  return (
    <div
      ref={mapContainer}
      style={{ height: '100vh', width: '100%' }}
    >
      {initialized && (
        <>
          <GeoTIFFViewer
            map={mapRef.current}
            isRasterVisible={isRasterVisible}
            opacity={opacity}
            selectedYear={selectedYear}
          />
          
          {(selectedT === '5' || selectedT === '20') && (
            <LegendControl
              legendImage={selectedT === '5' ? '/images/legend_T5.png' : '/images/legend_T20.png'}
              map={mapRef.current}
            />
          )}
        </>
      )}
    </div>
  );
};

export default MapView;