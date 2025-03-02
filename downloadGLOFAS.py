import cdsapi
import os
import json
import base64
import requests
from datetime import datetime


# Obtener las credenciales desde variables de entorno
CDSAPI_URL = os.getenv("CDSAPI_URL")  # URL de la API de Copernicus
CDSAPI_KEY = os.getenv("CDSAPI_KEY")  # Clave de la API (UID:API_KEY)
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")  # Token de GitHub
#GITHUB_REPO = os.getenv("REPO")  # Reemplaza con tu usuario y repositorio
GITHUB_REPO = "alimunozq/InundacionNetCDF"
GITHUB_BRANCH = "main"
#GITHUB_BRANCH = os.getenv("BRANCH")  # Reemplaza con la rama que deseas usar

# Configurar el cliente de la API de Copernicus
client = cdsapi.Client(url=CDSAPI_URL, key=CDSAPI_KEY)

# Obtener la fecha actual
fecha_actual = datetime.now()

# Guardar año, mes y día en strings separados
year = str(fecha_actual.year)
month = str(fecha_actual.month).zfill(2)  # Asegura 2 dígitos
day = str(fecha_actual.day).zfill(2)  

#def fetch_rlevel(download_dir, north, south, west, east):
def fetch_rlevel(day, month, year):
    print('Ingresando fetch_rlevel')
    print(year, '-', month, '-', day)
    # Coordenadas de toda la región de Coquimbo
    north = -29.0366    # Latitud máxima
    south = -32.28247   # Latitud mínima
    west = -71.71782    # Longitud mínima
    east = -69.809361   # Longitud máxima

    request = {
        "system_version": ["operational"],
        "hydrological_model": ["lisflood"],
        "product_type": ["control_forecast"],
        "variable": ["river_discharge_in_the_last_24_hours"],
        "year": [year],
        "month": [month],
        "day": [day],
        "leadtime_hour": ["24"],
        "data_format": "netcdf",
        "download_format": "unarchived",
        "area": [north, west, south, east],  # Asegúrate de que esto esté correcto
    }

    try:
        dataset = "cems-glofas-forecast"
        output_file = f"{year}{month}{day}.nc"  
        client.retrieve(dataset, request, output_file)
        print('Archivo descargado')
        # Subir el archivo a GitHub
        subir_archivo_a_github(output_file)
    except Exception as e:
        print(json.dumps({"error": str(e)}))

def subir_archivo_a_github(file_path):
    print(f"Intentando subir archivo: {file_path}")
    print(f"Ruta completa: https://api.github.com/repos/{GITHUB_REPO}/contents/download/{file_path}")
    with open(file_path, "rb") as file:
        file_content = file.read()

    url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/download/{file_path}"
    headers = {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json",
    }
    data = {
        "message": f"Subir archivo {file_path}",
        "content": base64.b64encode(file_content).decode("utf-8"),
        "branch": GITHUB_BRANCH,
    }
    response = requests.put(url, headers=headers, json=data)
    if response.status_code == 201:
        print(f"Archivo {file_path} subido a GitHub correctamente.")
    else:
        print(f"Error al subir el archivo: {response.status_code}")
        print(response.json())


def gestionar_archivos_en_repositorio(max_archivos):
    print('Entrando a gestionar archivos')
    # Obtener la lista de archivos en la carpeta "download"
    url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/download"
    headers = {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json",
    }
    response = requests.get(url, headers=headers)
    
    if response.status_code != 200:
        print(f"Error al obtener la lista de archivos: {response.status_code}")
        return

    # Obtener los archivos y sus fechas de creación
    archivos = response.json()
    archivos_con_fecha = []
    for archivo in archivos:
        if archivo["type"] == "file" and archivo["name"].endswith(".nc"):
            nombre_sin_extension = archivo["name"].replace(".nc", "")
            fecha_creacion = datetime.strptime(nombre_sin_extension, "%Y%m%d")
            archivos_con_fecha.append((archivo["name"], archivo["path"], archivo["sha"], fecha_creacion))

    # Ordenar archivos de más antiguo a más nuevo
    archivos_con_fecha.sort(key=lambda x: x[3])

    # Eliminar archivos si se supera el límite
    while len(archivos_con_fecha) > max_archivos:
        archivo_a_eliminar = archivos_con_fecha.pop(0)  # Obtener el archivo más antiguo
        eliminar_archivo_de_github(archivo_a_eliminar[1], archivo_a_eliminar[2])
        print(f"Archivo eliminado: {archivo_a_eliminar[0]}")

def eliminar_archivo_de_github(file_path, sha):
    url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{file_path}"
    headers = {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json",
    }
    data = {
        "message": f"Eliminar archivo {file_path}",
        "sha": sha,
        "branch": GITHUB_BRANCH,
    }
    response = requests.delete(url, headers=headers, json=data)
    if response.status_code == 200:
        print(f"Archivo {file_path} eliminado correctamente.")
    else:
        print(f"Error al eliminar el archivo: {response.status_code}")
        print(response.json())

if __name__ == "__main__":

    fetch_rlevel(day, month, year)  # Ajusta el orden
    gestionar_archivos_en_repositorio(max_archivos=3)
