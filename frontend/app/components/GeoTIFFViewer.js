'use client';
import { useEffect, useState } from 'react';
import * as GeoTIFF from 'geotiff';
import L from 'leaflet';
import '../styles/colorBar.css'; // Importa tu archivo CSS

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

  useEffect(() => {
    console.log('control1');
    if (!map || selectedYear === null) {
      if (rasterLayer) {
        map.removeLayer(rasterLayer);
        setRasterLayer(null);
      }
      return;
    }
    console.log('control2');

    const loadRaster = async () => {
      try {
        console.log('control3');
        if (rasterLayer) {
          map.removeLayer(rasterLayer);
          setRasterLayer(null);
        }

        const response = await fetch(`/geotiff/rl_${selectedYear}_Coquimbo.tif`);
        const arrayBuffer = await response.arrayBuffer();
        const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
        const image = await tiff.getImage();
        const raster = await image.readRasters();

        // Calcular valores mínimos y máximos
        const values = raster[0].filter(v => !isNaN(v));
        const min = Math.min(...values);
        const max = Math.max(...values);
        setMinMaxValues({ min, max });

        // Crear canvas e imagen
        const canvas = document.createElement('canvas');
        canvas.width = raster.width;
        canvas.height = raster.height;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(raster.width, raster.height);

        // Aplicar colores
        for (let i = 0; i < raster[0].length; i++) {
          const value = raster[0][i];
          const normalizedValue = !isNaN(value) ? value / max : 0;

          if (isNaN(value)) {
            imageData.data[i * 4 + 3] = 0;
          } else {
            const [r1, g1, b1] = COLOR_RAMP[0].color;
            const [r2, g2, b2] = COLOR_RAMP[1].color;
            
            imageData.data[i * 4] = r1 + (r2 - r1) * normalizedValue;
            imageData.data[i * 4 + 1] = g1 + (g2 - g1) * normalizedValue;
            imageData.data[i * 4 + 2] = b1 + (b2 - b1) * normalizedValue;
            imageData.data[i * 4 + 3] = 255;
          }
        }

        ctx.putImageData(imageData, 0, 0);
        console.log('control4');

        // Crear capa y añadir al mapa
        const bounds = image.getBoundingBox();
        const boundsLeaflet = L.latLngBounds(
          [bounds[1], bounds[0]],
          [bounds[3], bounds[2]]
        );

        const newRasterLayer = L.imageOverlay(canvas.toDataURL(), boundsLeaflet, {
          opacity,
          className: 'raster-no-interpolation'
        });

        // Asegurarse de que el mapa esté completamente listo
        if (map && !map.hasLayer(newRasterLayer)) {
          newRasterLayer.addTo(map);
          setRasterLayer(newRasterLayer);
        }
      } catch (error) {
        console.error('Error loading GeoTIFF:', error);
      }
    };

    console.log('control5');
    if (isRasterVisible && map) {
      loadRaster();
    }
  }, [isRasterVisible, selectedYear, map, opacity]);


  

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