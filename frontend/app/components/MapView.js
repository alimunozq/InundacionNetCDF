'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import GeoTIFFViewer from './GeoTIFFViewer';
import LegendControl from './LegendControl';
import PrecipitationLayer from './PrecipitationLayer';
import TemperatureLayer from './TemperatureLayer';

const MapView = ({ 
  selectedT, 
  latestTime, 
  setCoords, 
  isRasterVisible, 
  opacity, 
  selectedYear, 
  selectedLocation, 
  onMapClick, 
  precipitationPeriod,
  temperaturePeriod 
}) => {
  const mapContainer = useRef(null);
  const [map, setMap] = useState(null);
  const [marker, setMarker] = useState(null);
  const [getPrecipitationValue, setGetPrecipitationValue] = useState(null);
  const [getTemperatureValue, setGetTemperatureValue] = useState(null);

  // Inicializar el mapa
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mapInstance = L.map(mapContainer.current).setView([-30.5, -69.0], 8);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(mapInstance);

    setMap(mapInstance);

    return () => {
      mapInstance.remove();
    };
  }, []);

  // Cargar GeoJSON de Región de Coquimbo
  useEffect(() => {
    if (!map) return;

    let geoJsonLayer = null;

    fetch('/shapefiles/RegionCoquimbo4326.geojson')
      .then((response) => {
        if (!response.ok) throw new Error('GeoJSON fetch failed');
        return response.json();
      })
      .then((geojson) => {
        geoJsonLayer = L.geoJSON(geojson, {
          style: {
            color: '#000000',
            weight: 2,
            fillOpacity: 0,
            fill: false
          },
          onEachFeature: (feature, layer) => {
            const region = feature.properties?.Region || 'Sin nombre';
            layer.bindTooltip(region, { permanent: false });
          },
        }).addTo(map);
      })
      .catch((error) => {
        console.error('Error loading GeoJSON:', error);
      });

    return () => {
      if (geoJsonLayer) {
        map.removeLayer(geoJsonLayer);
      }
    };
  }, [map]);

  // Manejar clics en el mapa
  const handleMapClick = useCallback((e) => {
    const { lat, lng } = e.latlng;
    handleLocationSelect({ lat, lng }, true);

    let precipitationValue = null;
    let temperatureValue = null;

    if (getPrecipitationValue) {
      precipitationValue = getPrecipitationValue(lat, lng);
    }
    if (getTemperatureValue) {
      temperatureValue = getTemperatureValue(lat, lng);
    }

    if (onMapClick) {
      onMapClick({ lat, lng, precipitationValue, temperatureValue });
    }
  }, [getPrecipitationValue, getTemperatureValue, onMapClick]);

  useEffect(() => {
    if (!map) return;
    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [map, handleMapClick]);

  const handleLocationSelect = ({ lat, lng }, isMapClick = false) => {
    setCoords({ lat, lng });

    if (marker) {
      map.removeLayer(marker);
    }

    if (isMapClick) {
      const newMarker = L.marker([lat, lng]).addTo(map);
      setMarker(newMarker);
    }

    map.setView([lat, lng], 12);
  };

  useEffect(() => {
    if (!map || !selectedLocation) return;
    handleLocationSelect(selectedLocation, false);
  }, [selectedLocation, map]);

  const handlePrecipitationValueChange = useCallback((fn) => {
    setGetPrecipitationValue(() => fn);
  }, []);

  const handleTemperatureValueChange = useCallback((fn) => {
    setGetTemperatureValue(() => fn);
  }, []);

  // Cargar la capa WMS
  useEffect(() => {
    if (!map) return;

    let wmsLayer = null;

    if (selectedT === '5' && latestTime) {
      wmsLayer = L.tileLayer.wms('https://ows.globalfloods.eu/glofas-ows/ows.py', {
        layers: 'sumALHEGE',
        format: 'image/png',
        time: latestTime,
        transparent: true,
        version: '1.3.0',
        attribution: 'Globalfloods.eu',
      }).addTo(map);
    } else if (selectedT === '20' && latestTime) {
      wmsLayer = L.tileLayer.wms('https://ows.globalfloods.eu/glofas-ows/ows.py', {
        layers: 'sumALEEGE',
        format: 'image/png',
        time: latestTime,
        transparent: true,
        version: '1.3.0',
        attribution: 'Globalfloods.eu',
      }).addTo(map);
    }

    return () => {
      if (wmsLayer) {
        map.removeLayer(wmsLayer);
      }
    };
  }, [map, selectedT, latestTime]);

  return (
    <div
      ref={mapContainer}
      style={{ height: '100vh', width: '100%' }}
    >
      {map && (
        <>
          <GeoTIFFViewer
            map={map}
            isRasterVisible={isRasterVisible}
            opacity={opacity}
            selectedYear={selectedYear}
          />
          <PrecipitationLayer
            map={map}
            period={precipitationPeriod}
            onValueChange={handlePrecipitationValueChange}
          />
          <TemperatureLayer
            map={map}
            period={temperaturePeriod}
            onValueChange={handleTemperatureValueChange}
          />
        </>
      )}

      {(selectedT === '5' || selectedT === '20') && (
        <LegendControl
          legendImage={selectedT === '5' ? '/images/legend_T5.png' : '/images/legend_T20.png'}
          map={map}
        />
      )}
    </div>
  );
};

export default MapView;
