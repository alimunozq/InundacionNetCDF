'use client';
import React, { useState, useEffect } from 'react';
import Selector from './components/Selector';
import dynamic from 'next/dynamic';
import { getLatestTime } from './utils/getLatestTime';
import ChartComponent from './components/Chart';
import LocationSearch from './components/LocationSearch';

const MapView = dynamic(() => import('./components/MapView'), {
  ssr: false,
});

const Home = () => {
  const [selectedT, setSelectedT] = useState(null);
  const [latestTime, setLatestTime] = useState(null);
  const [coords, setCoords] = useState(null);
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [opacity, setOpacity] = useState(1);
  const [selectedYear, setSelectedYear] = useState(null);
  const [showChart, setShowChart] = useState(false);
  const [clickPosition, setClickPosition] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [precipitationPeriod, setPrecipitationPeriod] = useState('none');
  const [temperaturePeriod, setTemperaturePeriod] = useState('none');

  // Obtener la fecha más reciente
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
  };

  // Manejar clic en el mapa
  const handleMapClick = (clickData) => {
    console.log('Received click data in main component:', clickData);
    setClickPosition(clickData);
    setShowChart(true);
  };

  // Obtener datos cuando cambian las coordenadas
  useEffect(() => {
    if (!coords) return;

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

        if (!response.ok) throw new Error("Error al obtener datos");
        
        const data = await response.json();
        setResult(data);
      } catch (error) {
        console.error("Error al obtener datos:", error);
        setResult({ error: error.message });
      } finally {
        setIsLoading(false);
      }
    };
    handleSearch();
  }, [coords]);

  const handleOpacityChange = (event) => {
    setOpacity(parseFloat(event.target.value));
  };

  const yearDict = {
    "T = 1.5 años": "1.5",
    "T = 2 años": "2.0",
    "T = 5 años": "5.0",
    "T = 10 años": "10.0",
    "T = 20 años": "20.0",
    "T = 50 años": "50.0",
    "T = 100 años": "100.0",
    "T = 200 años": "200.0"
  };

  const handleYearChange = (event) => {
    setSelectedYear(event.target.value ? yearDict[event.target.value] : null);
  };

  const isRasterVisible = selectedYear !== null;

const handleLocationSearch = (place) => {
  console.log('Datos recibidos en handleLocationSearch:', place);
  
  const locationData = {
    lat: parseFloat(place.lat),
    lng: parseFloat(place.lon)
  };
  
  setSelectedLocation(locationData);
  // Ya no llamamos a setCoords aquí
};
  
const handleManualCoordinates = (coords) => {
  setSelectedLocation(coords);
  // Ya no llamamos a setCoords aquí
};
  


  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div style={{ width: '20%', padding: '20px', backgroundColor: 'white', overflowY: 'auto' }}>
        <Selector onChange={handleTChange} latestTime={latestTime} selectedT={selectedT} />
 
        <LocationSearch 
    onSearch={handleLocationSearch}
    onCoordinatesSubmit={handleManualCoordinates}
  />
        {selectedLocation && (
          <button
            onClick={() => {
              setCoords(selectedLocation); // Solo hacemos la consulta cuando se presiona el botón
              setShowChart(true);
            }}
            style={{
              width: '100%',
              padding: '8px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginTop: '10px'
            }}
          >
            Consultar en esta ubicación
          </button>
        )}
        {coords && (
          <div style={{ marginTop: '20px', padding: '10px', border: '1px solid #ccc', borderRadius: '5px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px' }}>Coordenadas:</h2>
            <p>Latitud: {typeof coords.lat === 'number' ? coords.lat.toFixed(3) : parseFloat(coords.lat).toFixed(3)}</p>
            <p>Longitud: {typeof coords.lng === 'number' ? coords.lng.toFixed(3) : parseFloat(coords.lng).toFixed(3)}</p>
            {isLoading ? (
              <p>⏳ Buscando información...</p>
            ) : (
              <>
                <p>Dis24: {result?.dis24_mean ? `${parseFloat(result.dis24_mean).toFixed(3)} [m³/s]` : "No disponible"}</p>
                {console.log('Click position:', clickPosition)}
                {clickPosition?.precipitationValue !== undefined && (
                  <p>Precipitación: {clickPosition.precipitationValue !== null ? 
                    `${clickPosition.precipitationValue.toFixed(2)} mm` : 
                    "No disponible"}
                  </p>
                )}
                {clickPosition?.temperatureValue !== undefined && (
                  <p>Temperatura: {clickPosition.temperatureValue !== null ? 
                    `${clickPosition.temperatureValue.toFixed(2)} °C` : 
                    "No disponible"}
                  </p>
                )}
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
                          .sort((a, b) => a.periodo - b.periodo)
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

        <select 
          onChange={handleYearChange} 
          value={selectedYear ? Object.keys(yearDict).find(key => yearDict[key] === selectedYear) : ''}
          style={{ marginTop: '20px', width: '100%', padding: '8px' }}
        >
          <option value="">Selecciona un año</option>
          {Object.keys(yearDict).map((key) => (
            <option key={key} value={key}>
              {key}
            </option>
          ))}
        </select>
               
        <div style={{ marginTop: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Período de Precipitación:</label>
          <select 
            value={precipitationPeriod}
            onChange={(e) => setPrecipitationPeriod(e.target.value)}
            style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
          >
            <option value="none">Ninguno</option>
            <option value="12h">Precipitación 12 horas</option>
            <option value="24h">Precipitación 24 horas</option>
          </select>
        </div>

        <div style={{ marginTop: '10px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Período de Temperatura:</label>
          <select 
            value={temperaturePeriod}
            onChange={(e) => setTemperaturePeriod(e.target.value)}
            style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
          >
            <option value="none">Ninguno</option>
            <option value="12h">Temperatura 12 horas</option>
            <option value="24h">Temperatura 24 horas</option>
          </select>
        </div>


        {isRasterVisible && (
          <div style={{ marginTop: '20px' }}>
            <label htmlFor="opacity">Opacidad del Raster: </label>
            <input
              type="range"
              id="opacity"
              min="0"
              max="1"
              step="0.1"
              value={opacity}
              onChange={handleOpacityChange}
              style={{ width: '100%' }}
            />
            <span> {opacity.toFixed(1)}</span>
          </div>
        )}
      </div>

      <div style={{ width: '80%', position: 'relative' }}>
        <MapView
          selectedT={selectedT}
          latestTime={latestTime}
          setCoords={setCoords}
          isRasterVisible={isRasterVisible}
          opacity={opacity}
          selectedYear={selectedYear}
          selectedLocation={selectedLocation}
          onMapClick={handleMapClick}
          precipitationPeriod={precipitationPeriod}
          temperaturePeriod={temperaturePeriod}
        />

        {showChart && result && (
          <div style={{
            position: 'absolute',
            bottom: '20px',
            right: '20px',
            width: '50%',
            height: '40%',
            backgroundColor: 'white',
            zIndex: 1000,
            boxShadow: '0 0 15px rgba(0,0,0,0.3)',
            borderRadius: '8px',
            padding: '15px',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <h3 style={{ margin: 0 }}>Análisis de Caudal</h3>
              <button 
                onClick={() => setShowChart(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#666',
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
              >
                X
              </button>
            </div>
            <div style={{ flex: 1 }}>
              <ChartComponent data={result} coords= {coords}/>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default Home;