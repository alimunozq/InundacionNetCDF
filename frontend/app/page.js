'use client';

import React, { useState, useEffect } from 'react';
import Selector from './components/Selector';
import dynamic from 'next/dynamic';
import { getLatestTime } from './utils/getLatestTime';

// Carga dinámicamente MapView para evitar errores en SSR
const MapView = dynamic(() => import('./components/MapView'), {
  ssr: false,
});

const Home = () => {
  const [selectedT, setSelectedT] = useState(null);
  const [latestTime, setLatestTime] = useState(null);
  const [coords, setCoords] = useState(null);
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);


  // Obtiene la fecha más reciente
  useEffect(() => {
    const fetchLatestTime = async () => {
      const time = await getLatestTime(
        'https://ows.globalfloods.eu/glofas-ows/ows.py',
        selectedT === '5' ? 'sumALHEGE' : 'sumALEEGE'
      );
      setLatestTime(time);
    };

    if (selectedT === '5' || selectedT === '20') {
      fetchLatestTime();
    }
  }, [selectedT]);

  const handleTChange = (selectedOption) => {
    setSelectedT(selectedOption);
    console.log('Período de retorno seleccionado:', selectedOption);
  };

  
  useEffect(() => {
    if (coords) {
      console.log('entro a coords');
      const handleSearch = async () => {
        setIsLoading(true);
        try {
          console.log('control1');
          // Construir la URL con los parámetros de latitud y longitud
          const url = new URL("https://inundacion-backend.onrender.com/consultar");
          url.searchParams.append("lat", coords.lat);
          url.searchParams.append("lon", coords.lng);
          console.log('control2');
          // Hacer la solicitud GET
          const response = await fetch(url.toString(), {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          });
          console.log('control3');
    
          if (!response.ok) {
            throw new Error("Error al obtener datos");
          }
    
          const data = await response.json();
          console.log('data', data);
          setResult(data);
        } catch (error) {
          console.error("Error al obtener datos:", error);
          setResult({ error: error.message });
        }  finally {
          setIsLoading(false);
        }
      };
      handleSearch();
    }
  }, [coords]);

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Barra lateral (Selector y coordenadas) */}
      <div style={{ width: '20%', padding: '20px', backgroundColor: 'white', overflowY: 'auto' }}>
        <Selector onChange={handleTChange} latestTime={latestTime} selectedT={selectedT} />

        {/* 🔥 Coordenadas dentro de la barra lateral */}
        {coords && (
          <div style={{ marginTop: '20px', padding: '10px', border: '1px solid #ccc', borderRadius: '5px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px' }}>Coordenadas:</h2>
            <p>Latitud: {coords.lat?.toFixed(3)}</p>
            <p>Longitud: {coords.lng?.toFixed(3)}</p>
            {isLoading ? (
      <p>⏳ Buscando información...</p> // 🔥 Mensaje de carga
    ) : (
      <p>Dis24: {result?.dis24 ? `${parseFloat(result.dis24).toFixed(3)} [m³/s]` : "No disponible"}</p>
    )}
          </div>
        )}
      </div>

      {/* Contenedor del mapa */}
      <div style={{ width: '80%' }}>
        <MapView selectedT={selectedT} latestTime={latestTime} setCoords={setCoords} />
      </div>
    </div>
  );
};

export default Home;
