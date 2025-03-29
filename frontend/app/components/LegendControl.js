'use client'; // Marca este componente como Client Component

import React, { useEffect } from 'react';
import L from 'leaflet'; // Importa L de leaflet

const LegendControl = ({ map, legendImage }) => {
  
  // Agrega la leyenda al mapa
  useEffect(() => {
    console.log('legendImage', legendImage);
    if (!map || !legendImage) return;

    const legend = L.control({ position: 'bottomright' }); // Posición de la leyenda

    legend.onAdd = () => {
      const div = L.DomUtil.create('div', 'legend');
      div.innerHTML = `<img src="${legendImage}" alt="Legend" 
      style="width: 150px; height: 300px; object-fit: contain;" />`;
      return div;
    };

    legend.addTo(map);

    // Limpia la leyenda al desmontar el componente
    return () => {
      legend.remove();
    };
  }, [map, legendImage]);

  return null;
};

export default LegendControl;