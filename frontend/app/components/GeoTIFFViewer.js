'use client';
import { useEffect, useState, useRef } from 'react';
import * as GeoTIFF from 'geotiff';
import L from 'leaflet';
import '../styles/colorBar.css';

const COLOR_RAMP = [
  { value: 0, color: [173, 216, 230] },
  { value: 1, color: [0, 0, 139] }
];

const ColorBar = ({ min, max }) => {
  return (
    <div className="color-bar">
      <span> Caudal:</span>
      <div className="color-gradient" 
           style={{ 
             background: `linear-gradient(to right, 
               rgb(${COLOR_RAMP[0].color.join(',')}), 
               rgb(${COLOR_RAMP[1].color.join(',')})` 
           }} />
      <div className="color-labels">
        <span>{min.toFixed(2)} m3/s</span>
        <span>{max.toFixed(2)} m3/s</span>
      </div>
    </div>
  );
};

const GeoTIFFViewer = ({ map, isRasterVisible, opacity, selectedYear }) => {
  const [rasterLayer, setRasterLayer] = useState(null);
  const [minMaxValues, setMinMaxValues] = useState({ min: 0, max: 1 });
  const rasterLayerRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!map || !isRasterVisible || selectedYear === null) {
      if (rasterLayerRef.current) {
        map.removeLayer(rasterLayerRef.current);
        rasterLayerRef.current = null;
      }
      return;
    }

    const loadRaster = async () => {
      try {
        // Eliminar capa existente
        if (rasterLayerRef.current) {
          map.removeLayer(rasterLayerRef.current);
        }

        // Cargar el archivo GeoTIFF
        const response = await fetch(`/geotiff/rl_${selectedYear}_Coquimbo.tif`);
        if (!response.ok) throw new Error('Failed to fetch GeoTIFF');
        
        const arrayBuffer = await response.arrayBuffer();
        const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
        const image = await tiff.getImage();
        const raster = await image.readRasters();

        // Calcular valores mínimos y máximos
        const values = raster[0].filter(v => !isNaN(v));
        const min = Math.min(...values);
        const max = Math.max(...values);
        setMinMaxValues({ min, max });

        // Crear canvas
        if (!canvasRef.current) {
          canvasRef.current = document.createElement('canvas');
        }
        const canvas = canvasRef.current;
        canvas.width = raster.width;
        canvas.height = raster.height;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(raster.width, raster.height);

        // Aplicar colores
        for (let i = 0; i < raster[0].length; i++) {
          const value = raster[0][i];
          const normalizedValue = !isNaN(value) ? (value - min) / (max - min) : 0;

          if (isNaN(value)) {
            imageData.data[i * 4 + 3] = 0; // Transparente
          } else {
            const [r1, g1, b1] = COLOR_RAMP[0].color;
            const [r2, g2, b2] = COLOR_RAMP[1].color;
            
            imageData.data[i * 4] = r1 + (r2 - r1) * normalizedValue;
            imageData.data[i * 4 + 1] = g1 + (g2 - g1) * normalizedValue;
            imageData.data[i * 4 + 2] = b1 + (b2 - b1) * normalizedValue;
            imageData.data[i * 4 + 3] = 255 * opacity; // Aplicar opacidad
          }
        }

        ctx.putImageData(imageData, 0, 0);

        // Obtener límites geográficos
        const bounds = image.getBoundingBox();
        const boundsLeaflet = L.latLngBounds(
          [bounds[1], bounds[0]],
          [bounds[3], bounds[2]]
        );

        // Crear nueva capa
        const newRasterLayer = L.imageOverlay(canvas.toDataURL(), boundsLeaflet, {
          opacity: 1, // La opacidad ya se aplicó en los píxeles
          className: 'raster-no-interpolation'
        });

        // Asegurarse de que el mapa esté listo
        if (map && map.getPane('overlayPane')) {
          newRasterLayer.addTo(map);
          rasterLayerRef.current = newRasterLayer;
          setRasterLayer(newRasterLayer);
        } else {
          console.warn('Map not ready for layer addition');
        }

      } catch (error) {
        console.error('Error loading GeoTIFF:', error);
      }
    };

    loadRaster();

    return () => {
      if (rasterLayerRef.current && map) {
        map.removeLayer(rasterLayerRef.current);
      }
    };
  }, [isRasterVisible, selectedYear, opacity, map]);

  return (
    <>
      {rasterLayer && (
        <div className="leaflet-bottom leaflet-left">
          <div className="leaflet-control leaflet-bar">
            <ColorBar min={minMaxValues.min} max={minMaxValues.max} />
          </div>
        </div>
      )}
    </>
  );
};

export default GeoTIFFViewer;