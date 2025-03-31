import cdsapi
import os
import json
import base64
import requests
from datetime import datetime
import xarray as xr
import geopandas as gpd
import rioxarray
import numpy as np
import rasterio
from tempfile import NamedTemporaryFile

# Obtener las credenciales desde variables de entorno
CDSAPI_URL = os.getenv("CDSAPI_URL")  # URL de la API de Copernicus
CDSAPI_KEY = os.getenv("CDSAPI_KEY")  # Clave de la API
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")  # Token de GitHub
GITHUB_REPO = "alimunozq/InundacionNetCDF"
GITHUB_BRANCH = "main"

# Configurar el cliente de la API de Copernicus
client = cdsapi.Client(url=CDSAPI_URL, key=CDSAPI_KEY)

# Obtener la fecha actual
fecha_actual = datetime.now()
year = str(fecha_actual.year)
month = str(fecha_actual.month).zfill(2)  
day = str(fecha_actual.day).zfill(2)

# Ruta del shapefile en formato GeoJSON
GEOJSON_URL = f"https://github.com/{GITHUB_REPO}/raw/{GITHUB_BRANCH}/frontend/public/shapefiles/RegionCoquimbo.geojson"

# Función para descargar datos sin guardar el archivo
def fetch_rlevel(day, month, year):
    print('Descargando datos...')
    north, south, west, east = -29.0366, -32.28247, -71.71782, -69.809361
    request = {
        "system_version": ["operational"],
        "hydrological_model": ["lisflood"],
        "product_type": ["ensemble_perturbed_forecasts"],
        "variable": ["river_discharge_in_the_last_24_hours"],
        "year": [year],
        "month": [month],
        "day": [day],
        "leadtime_hour": [str(i * 24) for i in range(1, 16)],
        "data_format": "netcdf",
        "download_format": "unarchived",
        "area": [north, west, south, east],
    }

    try:
        dataset = "cems-glofas-forecast"
        with NamedTemporaryFile(delete=True, suffix=".nc") as tmpfile:
            client.retrieve(dataset, request, tmpfile.name)
            print('Datos descargados, procesando...')
            return guardar_medias_y_desviaciones(tmpfile.name)
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        return None

# Función para guardar medias y desviaciones
def guardar_medias_y_desviaciones(archivo):
    dataset = xr.open_dataset(archivo)
    
    if "dis24" not in dataset:
        print("Error: La variable 'dis24' no está en el dataset.")
        return None

    mean_ds = dataset.mean(dim="number", skipna=True)
    std_ds = dataset.std(dim="number", skipna=True)

    combined_ds = xr.Dataset(
        {"mean_dis24": mean_ds["dis24"], "std_dis24": std_ds["dis24"]},
        coords={
            "latitude": dataset["latitude"],
            "longitude": dataset["longitude"],
            "forecast_period": dataset["forecast_period"],
            "forecast_reference_time": dataset["forecast_reference_time"],
        }
    )

    output_file = f"download/{year}{month}{day}.nc"
    combined_ds.to_netcdf(output_file)
    print(f"Archivo guardado como: {output_file}")

    subir_archivo_a_github("download", output_file)
    return output_file

# Función para subir archivo a GitHub

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



# Función para hacer clipping y generar GeoTIFFs
def clip_y_generar_geotiffs(archivo_nc):
    print(f"Procesando clip y generación de GeoTIFFs para {archivo_nc}...")

    try:
        ds = xr.open_dataset(archivo_nc, decode_timedelta=False)
        shapefile = gpd.read_file(GEOJSON_URL)

        ds["longitude"] = ds["longitude"].where(ds["longitude"] <= 180, ds["longitude"] - 360)
        ds = ds.rio.write_crs("EPSG:4326")
        shapefile = shapefile.to_crs("EPSG:4326")

        ds_clipped = ds.rio.clip(shapefile.geometry, shapefile.crs, drop=False)

        # Filtrar valores no deseados
        for var in ds_clipped.data_vars:
            if ds_clipped[var].dtype in [np.float32, np.float64]:
                ds_clipped[var] = ds_clipped[var].where(ds_clipped[var] >= 0.1)

        mean_dis24 = ds_clipped['mean_dis24']
        output_dir = "frontend/public/geotiff/resultados/"

        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

        for i, forecast_period_value in enumerate(ds_clipped['forecast_period']):
            for j in range(len(ds_clipped['forecast_reference_time'])):
                subarray = mean_dis24.isel(forecast_period=i, forecast_reference_time=j)
                band_data = subarray.values
                forecast_period_int = int(forecast_period_value.values)
                band_filename = f"{forecast_period_int}.tif"
                output_tif = os.path.join(output_dir, band_filename)

                transform = mean_dis24.rio.transform()
                crs = mean_dis24.rio.crs
                height, width = band_data.shape

                with rasterio.open(output_tif, 'w', driver='GTiff', count=1, dtype=band_data.dtype,
                                   height=height, width=width, crs=crs, transform=transform) as dst:
                    dst.write(band_data, 1)

                print(f"Archivo GeoTIFF guardado: {output_tif}")
                subir_archivo_a_github("frontend/public/geotiff/resultados", output_tif)

    except Exception as e:
        print(f"Error en clip_y_generar_geotiffs: {e}")

# Función principal
if __name__ == "__main__":
    archivo_nc = fetch_rlevel(day, month, year)
    if archivo_nc:
        clip_y_generar_geotiffs(archivo_nc)
