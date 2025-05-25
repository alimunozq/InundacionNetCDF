#instala ecmwd y cgbri
# 
# #conda install -c conda-forge cfgrib eccodes
#conda install -c conda-forge ecmwf-opendata

from ecmwf.opendata import Client
import xarray as xr
import rioxarray
from datetime import date
import os
import sys
import warnings  
import requests
import base64

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")  # Token de GitHub
GITHUB_REPO = "alimunozq/InundacionNetCDF"
GITHUB_BRANCH = "main"

def subir_archivo_a_github(folder, file_path):
    print(f"Subiendo archivo: {file_path}")
    file_name = os.path.basename(file_path)
    github_url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{folder}/{file_name}"
    headers = {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json",
    }

    # Verificar si el archivo ya existe en GitHub
    response = requests.get(github_url, headers=headers)
    if response.status_code == 200:
        file_sha = response.json().get("sha")  # Obtener el SHA si existe
    else:
        file_sha = None  # Si no existe, lo subiremos como nuevo archivo

    with open(file_path, "rb") as file:
        file_content = file.read()

    data = {
        "message": f"Actualizando {file_name}",
        "content": base64.b64encode(file_content).decode("utf-8"),
        "branch": GITHUB_BRANCH,
    }

    # Si el archivo ya existe, agregamos su SHA para sobreescribirlo
    if file_sha:
        data["sha"] = file_sha

    response = requests.put(github_url, headers=headers, json=data)
    if response.status_code in [200, 201]:
        print(f"Archivo {file_name} subido correctamente.")
    else:
        print(f"Error al subir {file_name}: {response.status_code}")
        print(response.json())


# Coordenadas de Coquimbo, Chile [north, south, west, east]
COQUIMBO_BBOX = {
    "north": -29.0366,
    "south": -32.28247,
    "west": -71.71782,
    "east": -69.809361
}

def crop_to_coquimbo(raster_data):
    """Recorta un raster a la región de Coquimbo"""
    return raster_data.rio.clip_box(
        minx=COQUIMBO_BBOX["west"],
        miny=COQUIMBO_BBOX["south"],
        maxx=COQUIMBO_BBOX["east"],
        maxy=COQUIMBO_BBOX["north"]
    )

def process_and_save(data, step, var_name, output_dir, current_date):
    """Procesa y guarda los datos con CRS definido"""
    # Asignar CRS explícitamente (WGS84)
    data = data.rio.write_crs("EPSG:4326")
    
    if var_name == "temp":
        data = data - 273.15  # Convertir K a °C
    
    # Recortar a Coquimbo
    data_coquimbo = crop_to_coquimbo(data)
    
    # Crear nombre de archivo con formato fecha+(P/T)+(12/24)
    var_code = "P" if var_name == "precip" else "T"
    file_prefix = f"{current_date}{var_code}{step}"
    
    # Guardar como GeoTIFF
    output_path = os.path.join(output_dir, f"{file_prefix}.tif")
    data_coquimbo.rio.to_raster(output_path, dtype="float32")
    return output_path

try:
    # Configuración
    target_date = date.today()
    current_date = target_date.strftime("%d%m%Y")  # Formato DDMMYYYY
    day = target_date.strftime("%Y%m%d")  # Formato YYYYMMDD para ECMWF
    output_dir = "coquimbo_meteo"
    os.makedirs(output_dir, exist_ok=True)

    # 1. Descargar datos
    client = Client(source="ecmwf")
    request = {
        "date": day,
        "time": 0,
        "type": "fc",
        "step": [12, 24],
        "param": ["tp", "2t"],
        "levtype": "sfc"
    }
    
    grib_file = os.path.join(output_dir, "data.grib2")
    client.retrieve(request, grib_file)

    # 2. Procesar datos
    try:
        # Abrir con cfgrib (ignorar advertencia de decode_timedelta)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", category=FutureWarning)
            ds = xr.open_dataset(grib_file, engine="cfgrib")
        
        # Listas para almacenar los paths de los archivos
        precip_paths = []
        temp_paths = []
        
        # Procesar cada paso temporal
        for step_idx, hour in enumerate([12, 24]):
            # Precipitación (mm)
            precip_path = process_and_save(
                ds.tp.isel(step=step_idx),
                hour,
                "precip",
                output_dir,
                current_date
            )
            precip_paths.append(precip_path)
            
            # Temperatura (°C)
            temp_path = process_and_save(
                ds.t2m.isel(step=step_idx),
                hour,
                "temp",
                output_dir,
                current_date
            )
            temp_paths.append(temp_path)
        
        # Subir archivos a GitHub
        print(f"Archivos de Coquimbo generados exitosamente:")
        for i, hour in enumerate([12, 24]):
            print(f"- Precipitación {hour}h: {os.path.basename(precip_paths[i])}")
            subir_archivo_a_github("frontend/public/coquimbo_meteo", precip_paths[i])
            
            print(f"- Temperatura {hour}h: {os.path.basename(temp_paths[i])}")
            subir_archivo_a_github("frontend/public/coquimbo_meteo", temp_paths[i])
    
    except Exception as e:
        print(f"Error procesando los datos GRIB: {str(e)}", file=sys.stderr)
        sys.exit(1)
        
    finally:
        # Limpiar archivo temporal
        if os.path.exists(grib_file):
            os.remove(grib_file)

except ModuleNotFoundError as e:
    print(f"Error: {str(e)}", file=sys.stderr)
    print("Soluciones posibles:", file=sys.stderr)
    print("1. Instala ecmwf-opendata: conda install -c conda-forge ecmwf-opendata", file=sys.stderr)
    print("2. Instala cfgrib: conda install -c conda-forge cfgrib eccodes", file=sys.stderr)
    sys.exit(1)
