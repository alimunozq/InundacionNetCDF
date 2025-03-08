'use client'; // Marca este componente como Client Component

import { useMap } from 'react-leaflet';
import React, { useState, useEffect } from 'react';

const MapClickHandler = ({setCoords}) => {
  const map = useMap();
  const [marker, setMarker] = useState(null); //var de estado para almacenar el marcador

  useEffect(() => {
    const handleClick = (e) => {

      // lógica para agregar marcador
      const {lat, lng} = e.latlng
      if (marker) {
        map.removeLayer(marker);
      }
      const newMarker = L.marker([lat, lng]).addTo(map);
      setMarker(newMarker);

      setCoords(e.latlng);
    };

    // Agrega el listener para el evento de clic
    map.on('click', handleClick);
    
    // Limpia el listener al desmontar el componente
    return () => {
      map.off('click', handleClick);
      if (marker) {
        map.removeLayer(marker);
      }
    };
  }, [map, setCoords, marker]);

  return null; // Este componente no renderiza nada
};

export default MapClickHandler;