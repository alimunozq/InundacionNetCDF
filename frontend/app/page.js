'use client';
import React, { useState, useEffect } from 'react';
import Selector from './components/Selector';
import dynamic from 'next/dynamic';
import { getLatestTime } from './utils/getLatestTime';
import DEMOverlay from './components/DEMOverlay'; // Importa el componente DEMOverlay

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
  const [showDem, setShowDem] = useState(false);  // Controla la visibilidad del DEM

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
      console.log('Coordenadas seleccionadas:', coords);
      const handleSearch = async () => {
        setIsLoading(true);
        try {
          const url = new URL("https://inundacion-backend.onrender.com/consultar");
          url.searchParams.append("lat", coords.lat);
          url.searchParams.append("lon", coords.lng);

          const response = await fetch(url.toString(), {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          });
    
          if (!response.ok) {
            throw new Error("Error al obtener datos");
          }
    
          const data = await response.json();
          console.log('Datos recibidos:', data);
          setResult(data);
        } catch (error) {
          console.error("Error al obtener datos:", error);
          setResult({ error: error.message });
        } finally {
          setIsLoading(false);
        }
      };
      handleSearch();
    }
  }, [coords]);

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div style={{ width: '20%', padding: '20px', backgroundColor: 'white', overflowY: 'auto' }}>
        <Selector onChange={handleTChange} latestTime={latestTime} selectedT={selectedT} />

        {coords && (
          <div style={{ marginTop: '20px', padding: '10px', border: '1px solid #ccc', borderRadius: '5px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px' }}>Coordenadas:</h2>
            <p>Latitud: {coords.lat?.toFixed(3)}</p>
            <p>Longitud: {coords.lng?.toFixed(3)}</p>
            {isLoading ? (
              <p>⏳ Buscando información...</p>
            ) : (
              <>
                <p>Dis24: {result?.dis24 && !isNaN(result.dis24) ? `${parseFloat(result.dis24).toFixed(3)} [m³/s]` : "No disponible"}</p>
                {result?.return_threshold && (
                  <div>
                    <h3>Valores de ReturnThreshold:</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                      <thead>
                        <tr>
                          <th style={{ border: '1px solid #ccc', padding: '5px' }}>Periodo de Retorno</th>
                          <th style={{ border: '1px solid #ccc', padding: '5px' }}>Q [m³/s]</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(result.return_threshold)
                          .map(([archivo, datos]) => {
                            const periodoRetorno = archivo.match(/rl_(\d+\.?\d*)/);
                            const periodo = periodoRetorno ? parseFloat(periodoRetorno[1]) : null;
                            const valor = Object.values(datos)[0];
                            return { periodo, valor };
                          })
                          .filter(item => item.periodo !== null)
                          .sort((a, b) => a.periodo - b.periodo) // Orden ascendente
                          .map(({ periodo, valor }, index) => (
                            <tr key={index}>
                              <td style={{ border: '1px solid #ccc', padding: '5px' }}>{periodo}</td>
                              <td style={{ border: '1px solid #ccc', padding: '5px' }}>{valor ? `${valor.toFixed(3)} ` : "No disponible"}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Botón para mostrar/ocultar DEM */}
        <button onClick={() => setShowDem(!showDem)}>
          {showDem ? 'Ocultar DEM' : 'Cargar DEM'}
        </button>
      </div>

      <div style={{ width: '80%' }}>
        <MapView selectedT={selectedT} latestTime={latestTime} setCoords={setCoords} />
      </div>

      {/* Aquí se incluye el componente DEMOverlay */}
      <DEMOverlay showDem={showDem} />
    </div>
  );
};

export default Home;
