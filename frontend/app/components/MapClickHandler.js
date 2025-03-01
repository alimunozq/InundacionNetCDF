'use client'; // Marca este componente como Client Component

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

const MapClickHandler = ({setCoords}) => {
  const map = useMap();

  useEffect(() => {
    const handleClick = (e) => {
      //console.log('Clic detectado en el mapa',  e.latlng); // Verifica que el clic se detecte
      setCoords(e.latlng);
    };

    // Agrega el listener para el evento de clic
    map.on('click', handleClick);
    
    // Limpia el listener al desmontar el componente
    return () => {
      map.off('click', handleClick);
    };
  }, [map, setCoords]);

  return null; // Este componente no renderiza nada
};

export default MapClickHandler;