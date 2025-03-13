import xarray as xr
import requests
import os
from flask import Flask, request, jsonify
import logging
from flask_cors import CORS

# Configuración
GITHUB_REPO = "alimunozq/InundacionNetCDF"  # Reemplaza con tu usuario/repositorio
GITHUB_TOKEN = os.getenv("MY_GITHUB_PAT")  # Reemplaza con tu PAT
CARPETAS = {"download": "download", "return_threshold": "ReturnThreshold"}  # Diccionario de carpetas disponibles

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "https://inundacion-frontend.vercel.app"}})

dataset = None

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def obtener_archivos(carpeta, obtener_todos=False):
    """
    Obtiene el último archivo o todos los archivos de la carpeta seleccionada en GitHub.
    """
    try:
        if carpeta not in CARPETAS:
            logger.info("❌ Carpeta inválida.")
            return []
        
        url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{CARPETAS[carpeta]}"
        headers = {
            "Authorization": f"token {GITHUB_TOKEN}",
            "Accept": "application/vnd.github.v3+json",
        }
        response = requests.get(url, headers=headers)
        response.raise_for_status()

        archivos = response.json()
        archivos_nc = [archivo for archivo in archivos if archivo["name"].endswith(".nc")]

        if not archivos_nc:
            logger.info("❌ No se encontraron archivos .nc en la carpeta.")
            return []
        
        archivos_nc.sort(key=lambda x: x["name"], reverse=True)
        
        return archivos_nc if obtener_todos else [archivos_nc[0]]

    except Exception as e:
        logger.info(f"❌ Error al obtener los archivos: {e}")
        return []

def descargar_archivo(url, ruta_local):
    """
    Descarga un archivo desde una URL y lo guarda localmente.
    """
    try:
        response = requests.get(url)
        response.raise_for_status()
        with open(ruta_local, "wb") as file:
            file.write(response.content)
        logger.info(f"✅ Archivo descargado y guardado en: {ruta_local}")
    except Exception as e:
        logger.info(f"❌ Error al descargar el archivo: {e}")

def leer_nc(ruta_archivo):
    """
    Lee un archivo NetCDF y lo procesa.
    """
    try:
        dataset = xr.open_dataset(ruta_archivo)
        return dataset
    except Exception as e:
        logger.info(f"❌ Error al leer el archivo: {e}")
        return None

def getValue(dataset, lat, lon):
    """
    Obtiene el valor de la variable más relevante del dataset para una latitud y longitud específicas.
    """
    try:
        variable = list(dataset.data_vars.keys())[0]  # Tomar la primera variable disponible
        filtered_data = dataset.sel(latitude=lat, longitude=lon + 360, method="nearest")
        valor = float(filtered_data[variable].values.item())
        return {variable: valor}
    except Exception as e:
        logger.info(f"❌ Error al filtrar el dataset: {e}")
        return None

@app.route('/consultar', methods=['GET'])
def consultar():
    """
    Endpoint para consultar el valor de dis24 para una latitud y longitud específicas.
    """
    try:
        lat = float(request.args.get('lat'))
        lon = float(request.args.get('lon'))
        
        # Obtener el último archivo de 'download'
        archivo_download = obtener_archivos("download", obtener_todos=False)
        resultado_download = None
        if archivo_download:
            ruta_local = "ultimo_archivo.nc"
            descargar_archivo(archivo_download[0]["download_url"], ruta_local)
            dataset = leer_nc(ruta_local)
            if dataset:
                resultado_download = getValue(dataset, lat, lon)
            os.remove(ruta_local)
        
        # Obtener todos los archivos de 'ReturnThreshold'
        archivos_return = obtener_archivos("return_threshold", obtener_todos=True)
        resultados_return = {}
        for archivo in archivos_return:
            ruta_local = archivo["name"]
            descargar_archivo(archivo["download_url"], ruta_local)
            dataset = leer_nc(ruta_local)
            if dataset:
                resultados_return[archivo["name"]] = getValue(dataset, lat, lon)
            os.remove(ruta_local)

        return jsonify({
            "lat": lat,
            "lon": lon,
            "dis24": resultado_download,
            "return_threshold": resultados_return
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/test', methods=['GET'])
def test():
    logger.info("🔍 Esto es una prueba")
    return jsonify({"message": "Prueba exitosa"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
