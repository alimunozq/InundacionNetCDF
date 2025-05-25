'use client';

import React, { useEffect, useState, useCallback } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fromUrl } from 'geotiff';
import * as turf from '@turf/turf';

const TemperatureLayer = ({ map, period, onValueChange }) => {
  const [layer, setLayer] = useState(null);
  const [error, setError] = useState(null);
  const [tiffData, setTiffData] = useState(null);
  const [coquimboRegion, setCoquimboRegion] = useState(null);

  // Cargar el GeoJSON de la región de Coquimbo
  useEffect(() => {
    const loadCoquimboRegion = async () => {
      try {
        const response = await fetch('/shapefiles/RegionCoquimbo4326.geojson');
        if (!response.ok) {
          throw new Error(`Failed to load GeoJSON: ${response.statusText}`);
        }
        const data = await response.json();
        setCoquimboRegion(data);
      } catch (error) {
        console.error('Error loading Coquimbo region:', error);
        setCoquimboRegion(null);
      }
    };
    loadCoquimboRegion();
  }, []);

  // Función para verificar si un punto está dentro de la región de Coquimbo
  const isPointInCoquimbo = useCallback((lat, lng) => {
    if (!coquimboRegion || !coquimboRegion.features || !coquimboRegion.features[0]) return false;
    const point = turf.point([lng, lat]);
    const polygon = coquimboRegion.features[0].geometry;
    return turf.booleanPointInPolygon(point, polygon);
  }, [coquimboRegion]);

  // Función para obtener el valor en un punto específico
  const getValueAtPoint = useCallback((lat, lng) => {
    if (!lat || !lng || !tiffData) return null;

    const { image, width, height } = tiffData;
    const bounds = image.getBoundingBox();

    // Verificar si el punto está dentro de los límites
    if (lat < bounds[1] || lat > bounds[3] || lng < bounds[0] || lng > bounds[2]) {
      return null;
    }

    // Convertir coordenadas geográficas a píxeles
    const x = Math.floor(((lng - bounds[0]) / (bounds[2] - bounds[0])) * width);
    const y = Math.floor(((bounds[3] - lat) / (bounds[3] - bounds[1])) * height);

    // Verificar si las coordenadas de píxel están dentro de los límites
    if (x < 0 || x >= width || y < 0 || y >= height) {
      return null;
    }

    // Obtener el valor del píxel
    return tiffData.data[y * width + x];
  }, [tiffData]);

  // Exponer la función getValueAtPoint al componente padre
  useEffect(() => {
    if (onValueChange) {
      onValueChange(getValueAtPoint);
    }
  }, [getValueAtPoint, onValueChange]);

  useEffect(() => {
    if (!map || !coquimboRegion) return;

    // Si periodo es 'none', eliminar la capa existente
    if (period === 'none') {
      if (layer) {
        map.removeLayer(layer);
        setLayer(null);
      }
      setTiffData(null);
      onValueChange(null);
      return;
    }

    const loadTemperatureData = async () => {
      try {
        const tiffUrl = `/coquimbo_meteo/coquimbo_temp_${period}.tif`;

        // Verificar si el archivo existe
        const response = await fetch(tiffUrl, { method: 'HEAD' });
        if (!response.ok) {
          throw new Error(`GeoTIFF file not found: ${tiffUrl}`);
        }

        const tiff = await fromUrl(tiffUrl);
        const image = await tiff.getImage();
        const data = await image.readRasters();
        const bounds = image.getBoundingBox();

        // Crear un canvas para visualizar los datos
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const width = image.getWidth();
        const height = image.getHeight();
        canvas.width = width;
        canvas.height = height;

        // Encontrar el rango de valores para la normalización
        const values = data[0];
        const min = Math.min(...values);
        const max = Math.max(...values);

        // Crear una imagen de datos para visualización
        const imageData = ctx.createImageData(width, height);
        let transparentPixels = 0;
        let coloredPixels = 0;

        for (let i = 0; i < values.length; i++) {
          const value = values[i];
          
          // Convertir índice a coordenadas geográficas
          const x = i % width;
          const y = Math.floor(i / width);
          const lng = bounds[0] + (x / width) * (bounds[2] - bounds[0]);
          const lat = bounds[3] - (y / height) * (bounds[3] - bounds[1]);

          // Si el punto está fuera de Coquimbo, hacerlo transparente
          if (!isPointInCoquimbo(lat, lng)) {
            imageData.data[i * 4 + 3] = 0; // alpha = 0
            transparentPixels++;
            continue;
          }

          // Para valores dentro de Coquimbo
          const normalizedValue = (value - min) / (max - min);
          const color = getColorForValue(normalizedValue);
          imageData.data[i * 4] = color.r;
          imageData.data[i * 4 + 1] = color.g;
          imageData.data[i * 4 + 2] = color.b;
          imageData.data[i * 4 + 3] = 255; // alpha = 255
          coloredPixels++;
        }

        console.log('Pixel counts:', { transparentPixels, coloredPixels });
        ctx.putImageData(imageData, 0, 0);

        // Crear una capa de imagen en el mapa
        const imageUrl = canvas.toDataURL();
        const imageBounds = [
          [bounds[1], bounds[0]], // [lat, lng] del punto suroeste
          [bounds[3], bounds[2]]  // [lat, lng] del punto noreste
        ];

        // Eliminar capa anterior si existe
        if (layer) {
          map.removeLayer(layer);
          setLayer(null);
        }

        const newLayer = L.imageOverlay(imageUrl, imageBounds, {
          opacity: 0.9
        }).addTo(map);

        setLayer(newLayer);
        setTiffData({ image, data: values, width, height });

      } catch (error) {
        console.error('Error loading temperature data:', error);
        if (layer) {
          map.removeLayer(layer);
          setLayer(null);
        }
        setTiffData(null);
        onValueChange(null);
      }
    };

    loadTemperatureData();

    return () => {
      if (layer) {
        map.removeLayer(layer);
        setLayer(null);
      }
      setTiffData(null);
      onValueChange(null);
    };
  }, [map, period, onValueChange, coquimboRegion, isPointInCoquimbo]);

  // Función para obtener el color basado en el valor normalizado
  const getColorForValue = (value) => {
    // Escala de colores de amarillo (frío) a rojo (calor)
    return {
      r: 255, // Rojo siempre al máximo
      g: Math.floor(255 * (1 - value)), // Verde disminuye con el valor
      b: 0 // Sin componente azul
    };
  };

  return null;
};

export default TemperatureLayer; 