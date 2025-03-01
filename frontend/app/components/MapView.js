'use client'; // Marca este componente como Client Component

import React from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import LegendControl from './LegendControl';
import MapClickHandler from './MapClickHandler'; // Importa el componente de manejo de clic
import { useEffect, useState } from 'react';

// Componente para agregar la capa WMS dinámicamente
const WMSTileLayer = ({ url, options }) => {
  const map = useMap();

  useEffect(() => {

    const layer = L.tileLayer.wms(url, options);

    // Maneja errores en la carga de la capa
    layer.on('tileerror', (error) => {
      console.error('Error al cargar la capa WMS:', error);
    });

    map.addLayer(layer);

    return () => {

      map.removeLayer(layer); // Limpia la capa al desmontar
    };
  }, [map, url, options]);

  return null;
};


  

const MapView = ({ selectedT, latestTime, setCoords }) => {
  const center = [-30.0, -71.0]; // Coordenadas de Coquimbo, Chile

  return (
    <MapContainer
      center={center}
      zoom={10}
      style={{ height: '100vh', width: '100%' }}
    >
        
      {/* Mapa base (OpenStreetMap) */}
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />

      {/* Capa WMS de Global Floods (sumALHEGE para T = 5) */}
      {selectedT === '5' && latestTime && (
        <WMSTileLayer
          url="https://ows.globalfloods.eu/glofas-ows/ows.py"
          options={{
            layers: 'sumALHEGE',
            format: 'image/png',
            time: latestTime, // Usa la fecha más reciente
            transparent: true,
            version: '1.3.0',
            attribution: 'Globalfloods.eu',
          }}
        />
      )}

      {/* Capa WMS de Global Floods (sumALEEGE para T = 20) */}
      {selectedT === '20' && latestTime && (
        <WMSTileLayer
          url="https://ows.globalfloods.eu/glofas-ows/ows.py"
          options={{
            layers: 'sumALEEGE', // Cambia el nombre de la capa
            format: 'image/png',
            time: latestTime, // Usa la fecha más reciente
            transparent: true,
            version: '1.3.0',
            attribution: 'Globalfloods.eu',
          }}
        />
      )}

      {/* Leyenda */}
      {(selectedT === '5' || selectedT === '20') && (
        <LegendControl legendImage={selectedT === '5' ? '/images/legend_T5.png' : '/images/legend_T20.png'} />
      )}

      {/* Maneja el evento de clic en el mapa */}
      <MapClickHandler setCoords={setCoords} />
    </MapContainer>
  );
};

export default MapView;