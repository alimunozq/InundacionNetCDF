import cdsapi
import os
import json
import base64
import requests

# Obtener las credenciales desde variables de entorno
CDSAPI_URL = os.getenv("CDSAPI_URL")  # URL de la API de Copernicus
CDSAPI_KEY = os.getenv("CDSAPI_KEY")  # Clave de la API (UID:API_KEY)
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")  # Token de GitHub
GITHUB_REPO = os.getenv("GITHUB_REPO")  # Reemplaza con tu usuario y repositorio
GITHUB_BRANCH = os.getenv("GITHUB_BRANCH")  # Reemplaza con la rama que deseas usar

# Configurar el cliente de la API de Copernicus
client = cdsapi.Client(url=CDSAPI_URL, key=CDSAPI_KEY)


# Coordenadas de toda la región de Coquimbo
lat_min = -32.28247
long_min = -71.71782
lat_max = -29.0366
long_max = -69.809361

# Luego usa estas coordenadas en tu solicitud a la API

def mkdir():
    download_dir = os.path.join(os.path.expanduser('~'), 'Downloads', 'glofas')
    os.makedirs(download_dir, exist_ok=True)
    return download_dir

#def fetch_rlevel(download_dir, north, south, west, east):
def fetch_rlevel(north, south, west, east):
    request = {
        "system_version": ["operational"],
        "hydrological_model": ["lisflood"],
        "product_type": ["control_forecast"],
        "variable": ["river_discharge_in_the_last_24_hours"],
        "year": ["2025"],
        "month": ["02"],
        "day": ["21"],
        "leadtime_hour": ["720"],
        "data_format": "netcdf",
        "download_format": "unarchived",
        "area": [north, west, south, east],  # Asegúrate de que esto esté correcto
    }


    try:
        dataset = "cems-glofas-forecast"
        output_file = "20250221.nc"
        #output = os.path.join(download_dir, 'glofas_output_prediction_1Cv2-control.nc')
        #client.retrieve(dataset, request, output)
        client.retrieve(dataset, request, output_file)
        
        #result = {"message": f"Data downloaded successfully to {output}"}
        #print(json.dumps(result))  # Devolver JSON
        # Subir el archivo a GitHub
        subir_archivo_a_github(output_file)
    except Exception as e:
        print(json.dumps({"error": str(e)}))

def subir_archivo_a_github(file_path):
    with open(file_path, "rb") as file:
        file_content = file.read()

    url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{file_path}"
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

if __name__ == "__main__":
    #download_dir = mkdir()
    fetch_rlevel(lat_max, lat_min, long_min, long_max)  # Ajusta el orden
