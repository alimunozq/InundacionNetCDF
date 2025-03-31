'use client';
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const LocationSearch = ({ onSearch, onCoordinatesSubmit }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [coordinates, setCoordinates] = useState({ lat: '', lng: '' });
  const [isSearching, setIsSearching] = useState(false);

 useEffect(() => {
     console.log('cambio en coordenadas', coordinates);
   }, [coordinates]);
  // Buscar sugerencias de lugares
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    try {
      const response = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${query}`);
      setSuggestions(response.data);
    } catch (error) {
      console.error('Error fetching location suggestions:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Manejar selección de sugerencia
  const handleSelectSuggestion = (place) => {
    setQuery(place.display_name);
    setCoordinates({
      lat: parseFloat(place.lat).toFixed(6),
      lng: parseFloat(place.lon).toFixed(6)
    });
    setSuggestions([]);
    if (onSearch) {
      onSearch({
        ...place,
        lat: parseFloat(place.lat),
        lng: parseFloat(place.lon)
      });
    }
  };

  // Manejar envío de coordenadas manuales
  const handleCoordinatesSubmit = (e) => {
    e.preventDefault();
    if (!coordinates.lat || !coordinates.lng) return;
    
    if (onCoordinatesSubmit) {
      onCoordinatesSubmit({
        lat: parseFloat(coordinates.lat),
        lng: parseFloat(coordinates.lng)
      });
    }
  };

  return (
    <div style={{ marginBottom: '20px' }}>
      <h3 style={{ marginBottom: '10px', fontSize: '16px', fontWeight: 'bold' }}>Buscar ubicación</h3>
      
      {/* Buscador de lugares */}
      <form onSubmit={handleSearch} style={{ marginBottom: '15px' }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar lugar..."
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #ccc'
            }}
          />
          <button 
            type="submit"
            disabled={isSearching}
            style={{
              position: 'absolute',
              right: '5px',
              top: '5px',
              background: 'none',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            {isSearching ? '⌛' : '🔍'}
          </button>
        </div>
      </form>

      {/* Lista de sugerencias */}
      {suggestions.length > 0 && (
        <ul style={{
          maxHeight: '200px',
          overflowY: 'auto',
          border: '1px solid #ddd',
          borderRadius: '4px',
          padding: '0',
          margin: '10px 0'
        }}>
          {suggestions.map((place, index) => (
            <li 
              key={index}
              onClick={() => handleSelectSuggestion(place)}
              style={{
                padding: '8px',
                borderBottom: '1px solid #eee',
                cursor: 'pointer',
                listStyle: 'none',
                fontSize: '14px'
              }}
            >
              {place.display_name}
            </li>
          ))}
        </ul>
      )}

      {/* Ingreso manual de coordenadas */}
      <form onSubmit={handleCoordinatesSubmit} style={{ marginTop: '15px' }}>
        <h4 style={{ marginBottom: '10px', fontSize: '14px' }}>O ingresar coordenadas:</h4>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Latitud</label>
            <input
              type="number"
              step="any"
              value={coordinates.lat}
              onChange={(e) => setCoordinates({...coordinates, lat: e.target.value})}
              placeholder="Ej: -30.123456"
              style={{
                width: '100%',
                padding: '6px',
                borderRadius: '4px',
                border: '1px solid #ccc'
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Longitud</label>
            <input
              type="number"
              step="any"
              value={coordinates.lng}
              onChange={(e) => setCoordinates({...coordinates, lng: e.target.value})}
              placeholder="Ej: -71.123456"
              style={{
                width: '100%',
                padding: '6px',
                borderRadius: '4px',
                border: '1px solid #ccc'
              }}
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={!coordinates.lat || !coordinates.lng}
          style={{
            width: '100%',
            padding: '8px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Usar estas coordenadas
        </button>
      </form>
    </div>
  );
};

export default LocationSearch;