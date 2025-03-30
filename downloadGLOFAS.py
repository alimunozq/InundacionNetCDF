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

# Obtener las credenciales desde variables de entorno
CDSAPI_URL = os.getenv("CDSAPI_URL")  # URL de la API de Copernicus
CDSAPI_KEY = os.getenv("CDSAPI_KEY")  # Clave de la API (UID:API_KEY)
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")  # Token de GitHub
GITHUB_REPO = "alimunozq/InundacionNetCDF"
GITHUB_BRANCH = "main"

# Configurar el cliente de la API de Copernicus
client = cdsapi.Client(url=CDSAPI_URL, key=CDSAPI_KEY)

# Obtener la fecha actual
fecha_actual = datetime.now()

# Guardar año, mes y día en strings separados
year = str(fecha_actual.year)
month = str(fecha_actual.month).zfill(2)  # Asegura 2 dígitos
day = str(fecha_actual.day).zfill(2)

# Función para descargar datos
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
        "product_type": ["ensemble_perturbed_forecasts"],
        "variable": ["river_discharge_in_the_last_24_hours"],
        "year": [year],
        "month": [month],
        "day": [day],
        "leadtime_hour": ["24",
                          "48",
                          "72",
                          "96",
                          "120",
                          "144",
                          "168",
                          "192",
                          "216",
                          "240",
                          "264",
                          "288",
                          "312",
                          "336",
                          "360"],
        "data_format": "netcdf",
        "download_format": "unarchived",
        "area": [north, west, south, east],
    }

    try:
        dataset = "cems-glofas-forecast"
        output_file = f"{year}{month}{day}.nc"  # Nombre del archivo .nc con fecha
        client.retrieve(dataset, request, output_file)
        print('Archivo descargado')
        
        # Aplicar la función guardar_medias_y_desviaciones al archivo descargado
        archivo_combinado = guardar_medias_y_desviaciones(output_file)
        
        # Aplicar la función clip_y_generar_geotiffs al archivo combinado
        clip_y_generar_geotiffs(archivo_combinado)
    
    except Exception as e:
        print(json.dumps({"error": str(e)}))

# Función para guardar medias y desviaciones
def guardar_medias_y_desviaciones(archivo):
    dataset = xr.open_dataset(archivo)
    mean_ds = dataset.mean(dim="number")
    std_ds = dataset.std(dim="number")
    
    combined_ds = xr.Dataset(
        {
            "mean_dis24": mean_ds["dis24"], 
            "std_dis24": std_ds["dis24"],
        },
        coords={
            "latitude": dataset["latitude"],
            "longitude": dataset["longitude"],
            "forecast_period": dataset["forecast_period"],
            "forecast_reference_time": dataset["forecast_reference_time"],
        }
    )
    
    # Guardamos el archivo con sufijo _st
    combined_file = archivo.replace(".nc", "_st.nc")
    combined_ds.to_netcdf(combined_file)
    print(f"Archivo guardado como: {combined_file}")
    
    # Subir el archivo combinado a GitHub
    subir_archivo_a_github('combined', combined_file)

    return combined_file

# Función para subir archivo a GitHub
def subir_archivo_a_github(folder, file_path):
    print(f"Intentando subir archivo: {file_path}")
    with open(file_path, "rb") as file:
        file_content = file.read()

    url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{folder}/{file_path}"
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

# Función para realizar el clipping y generar los GeoTIFFs
def clip_y_generar_geotiffs(archivo_nc):
    ds = xr.open_dataset(archivo_nc, decode_timedelta=False)
    shapefile_path = f"https://github.com/{GITHUB_REPO}/raw/{GITHUB_BRANCH}/fronent/public/shapefiles/RegionCoquimbo_Fixed.shp"
    shapefile = gpd.read_file(shapefile_path)

    ds["longitude"] = ds["longitude"].where(ds["longitude"] <= 180, ds["longitude"] - 360)
    ds = ds.rio.write_crs("EPSG:4326")
    shapefile = shapefile.to_crs("EPSG:4326")

    ds_clipped = ds.rio.clip(shapefile.geometry, shapefile.crs, drop=False)
    
    # Eliminar valores no deseados
    for var in ds_clipped.data_vars:
        if ds_clipped[var].dtype in [np.float32, np.float64]:
            ds_clipped[var] = ds_clipped[var].where(ds_clipped[var] >= 0.1)

    # Extraer la variable 'mean_dis24' y generar los GeoTIFFs
    mean_dis24 = ds_clipped['mean_dis24']
    output_dir = "frontend/public/geotiff/resultados"

    # Crear la carpeta si no existe
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

            with rasterio.open(output_tif, 'w', driver='GTiff',
                               count=1, dtype=band_data.dtype,
                               height=height, width=width, crs=crs, transform=transform) as dst:
                dst.write(band_data, 1)

            print(f"Archivo GeoTIFF guardado: {output_tif}")
            
            # Subir el archivo GeoTIFF a GitHub
            subir_archivo_a_github('frontend/public/geotiff/resultados', output_tif)

# Función principal
if __name__ == "__main__":
    fetch_rlevel(day, month, year)  # Descargar el archivo .nc y procesarlo
