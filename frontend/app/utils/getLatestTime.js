export const getLatestTime = async (wmsUrl, layerName) => {
    try {
      // Realiza una solicitud al servidor WMS para obtener las capacidades
      const response = await fetch(`${wmsUrl}?service=WMS&request=GetCapabilities`);
      const text = await response.text();
  
      // Parsea el XML para extraer la dimensión `time`
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, 'text/xml');
  
      // Busca la capa por su nombre
      const layers = xmlDoc.querySelectorAll('Layer > Name');
      let targetLayer = null;
  
      layers.forEach((layer) => {
        if (layer.textContent === layerName) {
          targetLayer = layer.parentElement;
        }
      });
  
      if (!targetLayer) {
        throw new Error(`No se encontró la capa ${layerName}`);
      }
  
      // Extrae la dimensión `time`
      const timeDimension = targetLayer.querySelector('Dimension[name="time"]');
      if (!timeDimension) {
        throw new Error(`No se encontró la dimensión 'time' para la capa ${layerName}`);
      }
  
      // Extrae la fecha más reciente del rango de tiempo
      const timeRange = timeDimension.textContent;
      const latestTime = timeRange.split('/')[1]; // El formato es "start/end/interval"
      return latestTime;
    } catch (error) {
      console.error('Error al obtener la fecha más reciente:', error);
      return null;
    }
  };