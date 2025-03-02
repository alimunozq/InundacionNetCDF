#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Created on Fri Feb 21 14:40:32 2025

@author: rbernals
"""

import xarray as xr
import requests
import os
from flask import Flask, request, jsonify
import logging
from flask_cors import CORS

# Configuración
GITHUB_REPO = "alimunozq/InundacionNetCDF"  # Reemplaza con tu usuario/repositorio
GITHUB_TOKEN = os.getenv("MY_GITHUB_PAT")  # Reemplaza con tu PAT
DOWNLOAD_FOLDER = "download"  # Carpeta en GitHub donde están los archivos

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "https://inundacion-frontend.vercel.app"}})

dataset = None
# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def obtener_ultimo_archivo():
    """
    Obtiene el último archivo de la carpeta `download` en GitHub.
    """
    try:
        url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{DOWNLOAD_FOLDER}"
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
            return None

        archivos_nc.sort(key=lambda x: x["name"], reverse=True)
        ultimo_archivo = archivos_nc[0]

        logger.info(f"📂 Último archivo encontrado: {ultimo_archivo['name']}")
        return ultimo_archivo["download_url"]

    except Exception as e:
        logger.info(f"❌ Error al obtener el último archivo: {e}")
        return None

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
    global dataset
    try:
        logger.info(f"📂 Abriendo archivo: {ruta_archivo}\n")
        dataset = xr.open_dataset(ruta_archivo)
        dataset['longitude'] = dataset['longitude'].round(3)
        logger.info("\n✅ Lectura finalizada.")
    except Exception as e:
        logger.info(f"❌ Error al leer el archivo: {e}")

def getValue(lat, lon):
    """
    Obtiene el valor de la variable 'dis24' para una latitud y longitud específicas.
    """
    global dataset
    try:
        filtered_data = dataset.sel(latitude=lat, longitude=lon + 360, method="nearest")
        valor_dis24 = float(filtered_data['dis24'].values)
        return valor_dis24
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
        url_ultimo_archivo = obtener_ultimo_archivo()
        if not url_ultimo_archivo:
            return jsonify({"error": "No se pudo obtener el último archivo."}), 500

        ruta_local = "ultimo_archivo.nc"
        descargar_archivo(url_ultimo_archivo, ruta_local)
        leer_nc(ruta_local)
        valor_dis24 = getValue(lat, lon)
        if valor_dis24 is None:
            return jsonify({"error": "No se encontró ningún dato para la latitud y longitud proporcionadas."}), 404

        os.remove(ruta_local)
        logger.info(f"🗑️ Archivo {ruta_local} eliminado.")
        return jsonify({"lat": lat, "lon": lon, "dis24": valor_dis24})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/test', methods=['GET'])
def test():
    logger.info("🔍 Esto es una prueba")
    return jsonify({"message": "Prueba exitosa"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
