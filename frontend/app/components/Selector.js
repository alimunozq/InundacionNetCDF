'use client'; // Marca este componente como Client Component

import React from 'react';
import '../styles/Selector.css';

const Selector = ({ onChange, latestTime, selectedT }) => {
  const options = [
    { value: 5, label: 'T = 5 años' },
    //{ value: 10, label: 'T = 10 años' },
    { value: 20, label: 'T = 20 años' },
    //{ value: 25, label: 'T = 25 años' },
    //{ value: 50, label: 'T = 50 años' },
  ];

  // Función para formatear la fecha
  const formatDate = (dateString) => {
    return dateString.split('T')[0]; // Extrae solo la parte de la fecha (YYYY-MM-DD)
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Caja selectora */}
      <select
        onChange={(e) => onChange(e.target.value)}
        value={selectedT || ''} // Controla el valor de la caja selectora
        className='custom-select'
      >
        <option value="" disabled>
          Por favor seleccione un período de retorno
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {/* Texto de la fuente de los datos (solo si selectedT es 5 o 20) */}
      {(selectedT === '5' || selectedT === '20') && (
        <div style={{ fontSize: '14px', color: '#555', lineHeight: '1.5' }}>
          <p>
            Datos proporcionados por el Servicio de Gestión de Emergencias de Copernicus (CEMS) y el
            Centro Europeo de Previsiones Meteorológicas a Plazo Medio (ECMWF).
          </p>
          {latestTime && (
            <p>
              Para el día: <strong>{formatDate(latestTime)}</strong>
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default Selector;