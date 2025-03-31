const handleSelectSuggestion = (place) => {
  console.log('Datos recibidos de la búsqueda:', place);
  
  if (!place || !place.lat || !place.lon) {
    console.error('Invalid place data:', place);
    return;
  }

  setQuery(place.display_name || '');
  const coordinates = {
    lat: parseFloat(place.lat),
    lng: parseFloat(place.lon)
  };

  console.log('Coordenadas procesadas:', coordinates);
  
  setCoordinates(coordinates);
  setSuggestions([]);
  
  if (onSearch) {
    const searchData = {
      ...place,
      lat: coordinates.lat,
      lng: coordinates.lng
    };
    console.log('Datos enviados a onSearch:', searchData);
    onSearch(searchData);
  }
}; 