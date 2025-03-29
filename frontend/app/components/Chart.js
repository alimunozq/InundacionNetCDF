'use client';
import '../styles/chart.css';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
/*
const dis24_mean = {
  24: 6.223124980926514,
  48: 6.144999980926514,
  72: 6.009375095367432,
  96: 5.925624847412109,
  120: 5.813125133514404,
  144: 5.744999885559082,
  168: 5.68625020980835,
  192: 5.591875076293945,
  216: 5.517499923706055,
  240: 5.478750228881836,
  264: 5.425624847412109,
  288: 5.360000133514404,
  312: 5.306875228881836,
  336: 5.250625133514404,
  360: 5.190000057220459
};

const dis24_std = {
  24: 0.027957838028669357,
  48: 0.03233129531145096,
  72: 0.026700012385845184,
  96: 0.02990218997001648,
  120: 0.03155476972460747,
  144: 0.02888554520905018,
  168: 0.03533323109149933,
  192: 0.03211916983127594,
  216: 0.03257204219698906,
  240: 0.036678507924079895,
  264: 0.047962382435798645,
  288: 0.04249999299645424,
  312: 0.048689864575862885,
  336: 0.047799207270145416,
  360: 0.04753288999199867
};
*/
const ChartComponent = ({data}) => {
  const dis24_mean = data.dis24_mean
  const dis24_std = data.dis24_std
  let yMin = Infinity;
  let yMax = -Infinity;
  const deviationMultiplier = 3;

  const formattedData = Object.keys(dis24_mean).map(key => {
    const hour = parseInt(key);
    const day = Math.floor(hour / 24);
    const mean = dis24_mean[key];
    const std = dis24_std[key];
    const upper = mean + (std * deviationMultiplier);
    const lower = Math.max(0, mean - (std * deviationMultiplier));

    yMin = Math.min(yMin, lower);
    yMax = Math.max(yMax, upper);

    return {
      hora: hour,
      dia: day,
      mean: mean,
      upper: upper,
      lower: lower
    };
  });

  const allZeros = formattedData.every(item => item.mean === 0);
  if (allZeros) {
    return <p className="text-center text-gray-500">No hay datos para mostrar</p>;
  }

  const yMargin = (yMax - yMin) * 0.10;
  yMin = Math.max(0, yMin - yMargin);
  yMax = yMax + yMargin;

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formattedData} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="dia"
            label={{ value: 'Días', position: 'bottom', offset: -15, className: 'axis-label' }}
            tick={{ className: 'axis-tick' }}
            interval={0}
            height={40}
          />
          <YAxis
            domain={[yMin.toFixed(2), yMax.toFixed(2)]}
            label={{ value: 'Caudal (m³/s)', angle: -90, position: 'left', className: 'axis-label' }}
            tick={{ className: 'axis-tick' }}
            tickFormatter={(value) => value.toFixed(2)}
          />
          <Tooltip
            formatter={(value, name) => {
              const names = {
                mean: 'Valor promedio',
                upper: `Promedio + ${deviationMultiplier}σ`,
                lower: `Promedio - ${deviationMultiplier}σ`
              };
              return [`${Number(value).toFixed(4)} m³/s`, names[name]];
            }}
          />
          <Legend
            formatter={(value) => {
              const legendMap = {
                mean: 'Valor promedio',
                upper: `Promedio + ${deviationMultiplier}σ`,
                lower: `Promedio - ${deviationMultiplier}σ`
              };
              return legendMap[value];
            }}
          />

          {/* Líneas */}
          <Line
            type="monotone"
            dataKey="mean"
            stroke="#8884d8"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6, stroke: '#8884d8', strokeWidth: 2 }}
          />
          <Line type="monotone" dataKey="upper" stroke="#82ca9d" strokeWidth={1} strokeDasharray="5 5" dot={false} />
          <Line type="monotone" dataKey="lower" stroke="#ff7300" strokeWidth={1} strokeDasharray="5 5" dot={false} />
          
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ChartComponent;
