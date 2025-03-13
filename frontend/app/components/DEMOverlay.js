'use client';

import React, { useState, useEffect } from 'react';
import * as d3 from 'd3';

const DEMOverlay = ({ showDem }) => {
  const [tiffImage, setTiffImage] = useState(null);
  const [imageData, setImageData] = useState(null);
  
  useEffect(() => {
    if (showDem) {
      const loadDem = async () => {
        try {
          const GeoTIFF = await import('geotiff');
          console.log("GeoTIFF:", GeoTIFF); // Verifica qué está exponiendo el módulo
          
          const tiff = await GeoTIFF.fromUrl('/ALOS_DSM_Export.tif'); // Sin `.default`
          const image = await tiff.getImage();
          const rasterData = await image.readRasters();
          setTiffImage(image);
          setImageData(rasterData[0]);
        } catch (error) {
          console.error('Error al cargar el DEM:', error);
        }
      };
      
      loadDem();
    }
  }, [showDem]);

  const processDemData = (data) => {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const colorScale = d3.scaleSequential(d3.interpolateYlGnBu).domain([min, max]);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const width = tiffImage.getWidth();
    const height = tiffImage.getHeight();
    
    canvas.width = width;
    canvas.height = height;

    const imageData = ctx.createImageData(width, height);
    for (let i = 0; i < data.length; i++) {
      const value = data[i];
      const color = d3.color(colorScale(value));
      const index = i * 4;
      imageData.data[index] = color.r;
      imageData.data[index + 1] = color.g;
      imageData.data[index + 2] = color.b;
      imageData.data[index + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL();
  };

  return (
    <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.7)', textAlign: 'center' }}>
      {imageData && (
        <img
          src={processDemData(imageData)}
          alt="DEM"
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      )}
    </div>
  );
};

export default DEMOverlay;
