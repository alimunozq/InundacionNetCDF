'use client'; // Marca este componente como Client Component

import React from 'react';
import { useMap } from 'react-leaflet';

const LegendControl = ({ legendImage }) => {
  const map = useMap();

  // Agrega la leyenda al mapa
  React.useEffect(() => {
    if (!legendImage) return;

    const legend = L.control({ position: 'bottomright' }); // Posición de la leyenda

    legend.onAdd = () => {
      const div = L.DomUtil.create('div', 'legend');
      div.innerHTML = `<img src="${legendImage}" alt="Legend" 
      style="width: 150px; height: 300px; object-fit: contain; "  />`;
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