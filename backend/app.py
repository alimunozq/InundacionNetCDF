import xarray as xr
import requests
import os
from flask import Flask, request, jsonify
import logging
from flask_cors import CORS
import numpy as np

# Configuración
GITHUB_REPO = "alimunozq/InundacionNetCDF"
GITHUB_TOKEN = os.getenv("MY_GITHUB_PAT")
CARPETAS = {"download": "download", "FloodThreshold": "FloodThreshold"}

app = Flask(__name__)

# Configuración CORS actualizada
CORS(app, resources={
    r"/.*": {
        "origins": [
            "https://inundacion-frontend.vercel.app",
            "https://inundacion-frontend.vercel.app/",
            "http://localhost:3000",
            "http://localhost:5173"
        ],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True,
        "max_age": 86400
    }
})

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def obtener_archivos(carpeta, obtener_todos=False):
    try:
        if carpeta not in CARPETAS:
            logger.error(f"Carpeta inválida: {carpeta}")
            return []

        url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{CARPETAS[carpeta]}"
        headers = {
            "Authorization": f"token {GITHUB_TOKEN}",
            "Accept": "application/vnd.github.v3+json",
        }
        
        logger.info(f"Solicitando archivos de: {url}")
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()

        archivos = response.json()
        archivos_nc = [archivo for archivo in archivos if isinstance(archivo, dict) and archivo.get("name", "").endswith(".nc")]

        if not archivos_nc:
            logger.warning(f"No se encontraron archivos .nc en {carpeta}")
            return []

        archivos_nc.sort(key=lambda x: x.get("name", ""), reverse=True)
        return archivos_nc if obtener_todos else [archivos_nc[0]]

    except Exception as e:
        logger.error(f"Error al obtener archivos de {carpeta}: {str(e)}")
        return []
    
def convert_numpy_types(obj):
    """Convierte tipos numpy a tipos nativos de Python para serialización JSON"""
    if isinstance(obj, (np.int32, np.int64)):
        return int(obj)
    elif isinstance(obj, (np.float32, np.float64)):
        return float(obj)
    elif isinstance(obj, dict):
        return {str(k) if isinstance(k, (np.int32, np.int64)) else k: convert_numpy_types(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [convert_numpy_types(x) for x in obj]
    return obj

def descargar_archivo(url, ruta_local):
    try:
        logger.info(f"Descargando archivo desde: {url}")
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        
        with open(ruta_local, "wb") as file:
            file.write(response.content)
            
        logger.info(f"Archivo descargado: {ruta_local}")
        return True
    except Exception as e:
        logger.error(f"Error al descargar {url}: {str(e)}")
        return False

def leer_nc(ruta_archivo):
    try:
        if not os.path.exists(ruta_archivo):
            logger.error(f"Archivo no encontrado: {ruta_archivo}")
            return None

        logger.info(f"Leyendo archivo NetCDF: {ruta_archivo}")
        dataset = xr.open_dataset(ruta_archivo)
        logger.info(f"Dataset cargado. Variables: {list(dataset.data_vars.keys())}")
        return dataset
    except Exception as e:
        logger.error(f"Error al leer {ruta_archivo}: {str(e)}")
        return None

def getValue(dataset, lat, lon):
    """
    Obtiene el valor de la variable más relevante del dataset para una latitud y longitud específicas.
    """
    try:
        variable = list(dataset.data_vars.keys())[0]
        logger.info(f'Variable encontrada: {variable}')
        
        # Ajustar longitud para variables relacionadas con dis24
        if variable in ['mean_dis24', 'std_dis24']:
            adjusted_lon = (lon + 360) % 360
            filtered_data = dataset[variable].sel(
                latitude=lat,
                longitude=adjusted_lon,
                method="nearest"
            )
        else:
            filtered_data = dataset[variable].sel(
                lat=lat,
                lon=lon,
                method="nearest"
            )
        valor = float(filtered_data.values.item())
        return {variable: valor}
    except Exception as e:
        logger.error(f"Error al filtrar el dataset: {e}")
        return None

def getMeanStdForAllForecasts(dataset, lat, lon):
    """Obtiene los valores de mean_dis24 y std_dis24 para todos los forecast_periods"""
    try:
        if dataset is None:
            logger.error("Dataset es None")
            return None, None

        # Verificar variables requeridas
        if 'mean_dis24' not in dataset or 'std_dis24' not in dataset:
            logger.error("Dataset no contiene las variables requeridas")
            return None, None

        # Obtener periodos de pronóstico
        forecast_periods = dataset['forecast_period'].values
        
        # Convertir a horas (asumiendo que forecast_period está en nanosegundos)
        forecast_hours = (forecast_periods / (1e9 * 60 * 60)).astype(int)
        forecast_hours = [int(h) for h in forecast_hours]

        mean_results = {}
        std_results = {}

        for fp, hours in zip(forecast_periods, forecast_hours):
            try:
                # Ajustar longitud
                adjusted_lon = (lon + 360) % 360

                # Obtener valores para mean_dis24
                mean_val = dataset['mean_dis24'].sel(
                    latitude=lat,
                    longitude=adjusted_lon,
                    forecast_period=fp,
                    method="nearest"
                ).values.item()

                # Obtener valores para std_dis24
                std_val = dataset['std_dis24'].sel(
                    latitude=lat,
                    longitude=adjusted_lon,
                    forecast_period=fp,
                    method="nearest"
                ).values.item()

                mean_results[hours] = float(mean_val)
                std_results[hours] = float(std_val)

            except Exception as e:
                logger.error(f"Error procesando forecast_period {fp}: {str(e)}")
                continue

        return mean_results, std_results

    except Exception as e:
        logger.error(f"Error en getMeanStdForAllForecasts: {str(e)}")
        return None, None

@app.route('/consultar', methods=['GET', 'OPTIONS'])
def consultar():
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'preflight'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', '*')
        response.headers.add('Access-Control-Allow-Methods', '*')
        return response
    
    try:
        logger.info("Iniciando consulta")
        
        # Validar parámetros
        try:
            lat = float(request.args.get('lat'))
            lon = float(request.args.get('lon'))
            logger.info(f"Coordenadas recibidas: lat={lat}, lon={lon}")
        except (TypeError, ValueError) as e:
            logger.error(f"Error en parámetros: {str(e)}")
            return jsonify({"error": "Coordenadas inválidas"}), 400

        # Procesar archivo de pronóstico
        dis24_mean = None
        dis24_std = None
        archivo_download = obtener_archivos("download")
        
        if archivo_download:
            ruta_local = "temp_download.nc"
            if descargar_archivo(archivo_download[0]["download_url"], ruta_local):
                dataset = leer_nc(ruta_local)
                if dataset:
                    dis24_mean, dis24_std = getMeanStdForAllForecasts(dataset, lat, lon)
                if os.path.exists(ruta_local):
                    os.remove(ruta_local)

        # Procesar archivos de umbrales
        resultados_return = {}
        archivos_return = obtener_archivos("FloodThreshold", obtener_todos=True)
        
        for archivo in archivos_return:
            ruta_local = f"temp_{archivo['name']}"
            if descargar_archivo(archivo["download_url"], ruta_local):
                dataset = leer_nc(ruta_local)
                if dataset:
                    resultados_return[archivo["name"]] = getValue(dataset, lat, lon)
                if os.path.exists(ruta_local):
                    os.remove(ruta_local)

        response = {
            "lat": lat,
            "lon": lon,
            "dis24_mean": dis24_mean,
            "dis24_std": dis24_std,
            "return_threshold": resultados_return
        }
        
        # Convertir tipos numpy antes de serializar
        response = convert_numpy_types(response)
        
        logger.info(f"Respuesta preparada: {response}")
        return jsonify(response)

    except Exception as e:
        logger.error(f"Error en endpoint /consultar: {str(e)}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500

@app.route('/test', methods=['GET'])
def test():
    logger.info("Prueba de servicio")
    return jsonify({
        "status": "ok",
        "message": "Servicio funcionando",
        "endpoints": {
            "/consultar": "Consulta datos de inundación",
            "/test": "Prueba de servicio"
        }
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)