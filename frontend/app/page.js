"use client";

import { useState } from "react";

export default function SearchForm() {
  const [inputs, setInputs] = useState({
    lat: "",
    lon: "",
  });
  const [result, setResult] = useState(null);

  const handleChange = (e) => {
    setInputs({ ...inputs, [e.target.name]: e.target.value });
  };

  const handleSearch = async () => {
    try {
      // Construir la URL con los parámetros de latitud y longitud
      const url = new URL("https://inundacion-backend.onrender.com/consultar");
      url.searchParams.append("lat", inputs.lat);
      url.searchParams.append("lon", inputs.lon);

      // Hacer la solicitud GET
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Error al obtener datos");
      }

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error("Error al obtener datos:", error);
      setResult({ error: error.message });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-6">
      <div className="bg-white p-6 rounded-lg shadow-lg w-96">
        <h1 className="text-xl font-bold mb-4">Buscar en Glofas</h1>
        <input
          name="lat"
          type="text"
          placeholder="Latitud"
          value={inputs.lat}
          onChange={handleChange}
          className="border p-2 w-full mb-2"
        />
        <input
          name="lon"
          type="text"
          placeholder="Longitud"
          value={inputs.lon}
          onChange={handleChange}
          className="border p-2 w-full mb-2"
        />

        <button
          onClick={handleSearch}
          className="bg-blue-500 text-white px-4 py-2 rounded w-full"
        >
          Buscar
        </button>
      </div>
      {result && (
        <div className="mt-4 bg-white p-4 rounded-lg shadow-lg w-96">
          <h2 className="text-lg font-bold">Resultados:</h2>
          {result.error ? (
            <p className="text-red-500">{result.error}</p>
          ) : (
            <pre className="text-sm">
              Latitud: {result.lat}, Longitud: {result.lon}, Dis24: {result.dis24}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}