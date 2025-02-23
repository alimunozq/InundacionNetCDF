import cdsapi
import os
import sys
import json

# Obtener las credenciales desde variables de entorno
CDSAPI_URL = os.getenv("CDSAPI_URL")  # URL de la API de Copernicus
CDSAPI_KEY = os.getenv("CDSAPI_KEY")  # Clave de la API (UID:API_KEY)

# Configurar el cliente de la API de Copernicus
c = cdsapi.Client(url=CDSAPI_URL, key=CDSAPI_KEY)


# Asegúrate de que tu script pueda recibir estos parámetros
lat_min = float(sys.argv[1])
long_min = float(sys.argv[2])
lat_max = float(sys.argv[3])
long_max = float(sys.argv[4])

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
        #output = os.path.join(download_dir, 'glofas_output_prediction_1Cv2-control.nc')
        #client.retrieve(dataset, request, output)
        client.retrieve(dataset, request, "20250221.nc")
        
        #result = {"message": f"Data downloaded successfully to {output}"}
        #print(json.dumps(result))  # Devolver JSON
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    #download_dir = mkdir()
    fetch_rlevel(lat_max, lat_min, long_min, long_max)  # Ajusta el orden
