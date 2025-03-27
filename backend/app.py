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
CORS(app, resources={
    r"/*": {
        "origins": ["https://inundacion-frontend.vercel.app", "http://localhost:3000"],
        "methods": ["GET", "POST"],
        "allow_headers": ["Content-Type"]
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

def getValuesForAllForecasts(dataset, lat, lon):
    try:
        if dataset is None:
            logger.error("Dataset es None")
            return None

        variable = list(dataset.data_vars.keys())[0]
        logger.info(f"Procesando variable: {variable}")

        if 'forecast_period' not in dataset.dims:
            logger.error("Dataset no tiene dimensión forecast_period")
            return None

        forecast_periods = dataset['forecast_period'].values
        logger.info(f"Valores de forecast_period: {forecast_periods}")

        # Conversión segura a horas
        try:
            forecast_hours = (forecast_periods / (1e9 * 60 * 60)).astype(int)
            logger.info(f"Periodos convertidos a horas: {forecast_hours}")
        except Exception as e:
            logger.error(f"Error convirtiendo forecast_period: {str(e)}")
            return None

        results = {}
        
        for fp, hours in zip(forecast_periods, forecast_hours):
            try:
                if variable == 'dis24':
                    filtered_data = dataset.sel(
                        latitude=lat,
                        longitude=(lon + 360) % 360,  # Manejo seguro de longitud
                        forecast_period=fp,
                        method="nearest"
                    )
                else:
                    filtered_data = dataset.sel(
                        lat=lat,
                        lon=lon,
                        forecast_period=fp,
                        method="nearest"
                    )

                valor = float(filtered_data[variable].values.item())
                results[hours] = valor
                logger.info(f"Valor para {hours}h: {valor}")

            except Exception as e:
                logger.error(f"Error procesando {hours}h: {str(e)}")
                continue

        return results if results else None

    except Exception as e:
        logger.error(f"Error en getValuesForAllForecasts: {str(e)}")
        return None

@app.route('/consultar', methods=['GET'])
def consultar():
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
        resultado_download = None
        archivo_download = obtener_archivos("download")
        
        if archivo_download:
            ruta_local = "temp_download.nc"
            if descargar_archivo(archivo_download[0]["download_url"], ruta_local):
                dataset = leer_nc(ruta_local)
                if dataset:
                    resultado_download = getValuesForAllForecasts(dataset, lat, lon)
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
                    resultados_return[archivo["name"]] = getValuesForAllForecasts(dataset, lat, lon)
                if os.path.exists(ruta_local):
                    os.remove(ruta_local)

        response = {
            "lat": lat,
            "lon": lon,
            "dis24": resultado_download,
            "return_threshold": resultados_return
        }
        
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