#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Created on Fri Feb 21 14:40:32 2025

@author: rbernals
"""

import xarray as xr
import pandas as pd
import requests
import os
from datetime import datetime
from flask import Flask, request, jsonify

# Configuración
GITHUB_REPO = "alimunozq/InundacionNetCDF"  # Reemplaza con tu usuario/repositorio
GITHUB_TOKEN = os.getenv("MY_GITHUB_PAT") # Reemplaza con tu PAT
DOWNLOAD_FOLDER = "download"  # Carpeta en GitHub donde están los archivos

app = Flask(__name__)
dataset = None
df = None

def obtener_ultimo_archivo():
    """
    Obtiene el último archivo de la carpeta `download` en GitHub.
    """
    try:
        # URL de la API de GitHub para obtener el contenido de la carpeta
        url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{DOWNLOAD_FOLDER}"
        headers = {
            "Authorization": f"token {GITHUB_TOKEN}",
            "Accept": "application/vnd.github.v3+json",
        }
        response = requests.get(url, headers=headers)
        response.raise_for_status()

        # Obtener la lista de archivos
        archivos = response.json()
        archivos_nc = [archivo for archivo in archivos if archivo["name"].endswith(".nc")]

        if not archivos_nc:
            print("❌ No se encontraron archivos .nc en la carpeta.")
            return None

        # Ordenar archivos por nombre (asumiendo que el nombre contiene la fecha)
        archivos_nc.sort(key=lambda x: x["name"], reverse=True)
        ultimo_archivo = archivos_nc[0]

        print(f"📂 Último archivo encontrado: {ultimo_archivo['name']}")
        return ultimo_archivo["download_url"]

    except Exception as e:
        print(f"❌ Error al obtener el último archivo: {e}")
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
        print(f"✅ Archivo descargado y guardado en: {ruta_local}")
    except Exception as e:
        print(f"❌ Error al descargar el archivo: {e}")

def leer_nc(ruta_archivo):
    """
    Lee un archivo NetCDF y lo procesa.
    """
    global dataset
    global df
    try:
        print(f"📂 Abriendo archivo: {ruta_archivo}\n")

        # Cargar el archivo NetCDF
        dataset = xr.open_dataset(ruta_archivo)

        # Convertir a DataFrame
        df = dataset.to_dataframe().reset_index()
        df['longitude_rounded'] = df['longitude'].round(3)

        # Cerrar dataset
        dataset.close()
        print("\n✅ Lectura finalizada.")

    except Exception as e:
        print(f"❌ Error al leer el archivo: {e}")

def getValue(lat, lon):
    """
    Obtiene el valor de la variable 'dis24' para una latitud y longitud específicas.
    """
    global df
    try:
        filtered_df = df[(df['latitude'] == lat) & (df['longitude_rounded'] == lon + 360)]
        if not filtered_df.empty:
            # Devolver el valor de dis24
            return filtered_df['dis24'].values[0]
        else:
            print(f"❌ No se encontró ningún dato para lat={lat}, lon={lon}")
            return None
    except Exception as e:
        print(f"❌ Error al filtrar el DataFrame: {e}")
        return None

@app.route('/consultar', methods=['GET'])
def consultar():
    """
    Endpoint para consultar el valor de dis24 para una latitud y longitud específicas.
    """
    try:
        # Obtener lat y lon de los parámetros de la URL
        lat = float(request.args.get('lat'))
        lon = float(request.args.get('lon'))

        # Obtener el último archivo de la carpeta `download`
        url_ultimo_archivo = obtener_ultimo_archivo()
        if not url_ultimo_archivo:
            return jsonify({"error": "No se pudo obtener el último archivo."}), 500

        # Descargar el archivo
        ruta_local = "ultimo_archivo.nc"
        descargar_archivo(url_ultimo_archivo, ruta_local)

        # Leer y procesar el archivo
        leer_nc(ruta_local)

        # Obtener el valor de dis24
        valor_dis24 = getValue(lat, lon)
        if valor_dis24 is None:
            return jsonify({"error": "No se encontró ningún dato para la latitud y longitud proporcionadas."}), 404

        # Eliminar el archivo descargado (opcional)
        os.remove(ruta_local)
        print(f"🗑️ Archivo {ruta_local} eliminado.")

        # Devolver el resultado
        return jsonify({"lat": lat, "lon": lon, "dis24": valor_dis24})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Iniciar el servidor Flask
    app.run(host='0.0.0.0', port=5000)
