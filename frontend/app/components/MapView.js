'use client';

import React, { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import GeoTIFFViewer from './GeoTIFFViewer';
import LegendControl from './LegendControl';

const MapView = ({ selectedT, latestTime, setCoords, isRasterVisible, opacity, selectedYear, selectedLocation, onMapClick }) => {
  const mapContainer = useRef(null);
  const [map, setMap] = useState(null);
  const [marker, setMarker] = useState(null); // Estado para el marcador seleccionado

  // Inicializar el mapa
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mapInstance = L.map(mapContainer.current).setView([-30.5, -69.0], 8);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(mapInstance);

    setMap(mapInstance);

    return () => {
      mapInstance.remove();
    };
  }, []);

  useEffect(() => {
    if (!map || !selectedLocation) return;
    handleLocationSelect(selectedLocation, false);
  }, [selectedLocation]); // <-- Escucha cambios en `selectedLocation`

  // Función para agregar marcador y hacer zoom
  const handleLocationSelect = ({ lat, lng }, isMapClick = false) => {
    setCoords({ lat, lng });

    // Eliminar marcador anterior si existe
    if (marker) {
      map.removeLayer(marker);
    }

    // Solo crear nuevo marcador si es un clic en el mapa
    if (isMapClick) {
      const newMarker = L.marker([lat, lng]).addTo(map);
      setMarker(newMarker);
    }

    // Hacer zoom al nuevo marcador
    map.setView([lat, lng], 12);
  };

  // Manejar clics en el mapa
  useEffect(() => {
    if (!map) return;

    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      handleLocationSelect({ lat, lng }, true); // Pass true to indicate it's a map click

      if (onMapClick) {
        onMapClick({ lat, lng });
      }
    });

    return () => {
      map.off('click');
    };
  }, [map, marker]);

  // Escuchar cambios en selectedLocation (buscador o coordenadas)
  useEffect(() => {
    if (!map || !selectedLocation) return;
    
    handleLocationSelect(selectedLocation, false); // Pass false to indicate it's not a map click
  }, [selectedLocation]);

  // Cargar la capa WMS
  useEffect(() => {
    if (!map) return;

    let wmsLayer = null;

    if (selectedT === '5' && latestTime) {
      wmsLayer = L.tileLayer.wms('https://ows.globalfloods.eu/glofas-ows/ows.py', {
        layers: 'sumALHEGE',
        format: 'image/png',
        time: latestTime,
        transparent: true,
        version: '1.3.0',
        attribution: 'Globalfloods.eu',
      }).addTo(map);
    } else if (selectedT === '20' && latestTime) {
      wmsLayer = L.tileLayer.wms('https://ows.globalfloods.eu/glofas-ows/ows.py', {
        layers: 'sumALEEGE',
        format: 'image/png',
        time: latestTime,
        transparent: true,
        version: '1.3.0',
        attribution: 'Globalfloods.eu',
      }).addTo(map);
    }

    return () => {
      if (wmsLayer) {
        map.removeLayer(wmsLayer);
      }
    };
  }, [map, selectedT, latestTime]);

  return (
    <div
      ref={mapContainer}
      style={{ height: '100vh', width: '100%' }}
    >
      {map && (
        <GeoTIFFViewer
          map={map}
          isRasterVisible={isRasterVisible}
          opacity={opacity}
          selectedYear={selectedYear}
        />
      )}

      {(selectedT === '5' || selectedT === '20') && (
        <LegendControl
          legendImage={selectedT === '5' ? '/images/legend_T5.png' : '/images/legend_T20.png'}
          map={map}
        />
      )}
    </div>
  );
};

export default MapView;
