useEffect(() => {
    if (!coords) return;

    const handleSearch = async () => {
      setIsLoading(true);
      try {
        const url = new URL("https://inundacion-backend.onrender.com/consultar");
        url.searchParams.append("lat", coords.lat);
        url.searchParams.append("lon", coords.lng);
        // ... resto del código
      }
      // ...
    };
    handleSearch();
  }, [coords]); 

const handleLocationSearch = (place) => {
  setSelectedLocation(place); 
  // Solo actualizamos la vista del mapa
  // No actualizamos coords aquí
};
  
const handleManualCoordinates = (coords) => {
  setSelectedLocation({ lat: coords.lat, lng: coords.lng });
  // Solo actualizamos la vista del mapa
  // No actualizamos coords aquí
};

// Nuevo manejador para clics en el mapa
const handleMapClick = (clickData) => {
  setSelectedLocation(clickData);
  setCoords(clickData); // Aquí sí actualizamos coords para hacer la consulta
  setShowChart(true);
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
        // ... resto del código ...
      </div>
    </div>
  ); 