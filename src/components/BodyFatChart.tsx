import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  CartesianGrid, ResponsiveContainer, Brush, ReferenceLine,
} from 'recharts';
import { HealthData } from '../types';
import { formatTick, getYearStarts } from '../utils/dateFormat';

interface Props {
  data: HealthData;
  height?: number;
  xInterval?: number;
}

export default function BodyFatChart({ data, height = 350, xInterval = 7 }: Props) {
  const chartData = data.dates.map((d, i) => ({
    date: d,
    body_fat: data.body_fat_percents[i] ?? null,
    sma7_bf:  data.sma7_body_fat[i]    ?? null,
  }));

  const validVals = data.body_fat_percents.filter((v): v is number => v !== null && v > 0);
  const bfMin = validVals.length > 0 ? Math.floor(Math.min(...validVals)) - 1 : 0;
  const bfMax = validVals.length > 0 ? Math.ceil(Math.max(...validVals)) + 1 : 50;

  const n         = data.dates.length;
  const showBrush = n > 90;
  const yearStarts = getYearStarts(data.dates);
  const fmt = (dateStr: string) => formatTick(dateStr, n);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: showBrush ? 8 : 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          angle={-45}
          textAnchor="end"
          tick={{ fontSize: 10 }}
          interval={xInterval}
          height={50}
          tickFormatter={fmt}
        />
        <YAxis domain={[bfMin, bfMax]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} width={52} />
        <Tooltip formatter={(v: number, name: string) => [`${v} %`, name]} labelFormatter={fmt} />
        <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 4 }} />

        {yearStarts.map(d => (
          <ReferenceLine
            key={d}
            x={d}
            stroke="#aaa"
            strokeWidth={1.5}
            label={{ value: d.slice(0, 4), position: 'insideTopRight', fontSize: 11, fill: '#888', fontWeight: 700 }}
          />
        ))}

        <Line type="monotone" dataKey="body_fat" name="体脂肪率" stroke="#8e44ad" strokeWidth={2} dot={n > 90 ? false : { r: 3 }} activeDot={{ r: 5 }} connectNulls={false} />
        <Line type="monotone" dataKey="sma7_bf"  name="7日SMA"  stroke="#27ae60" strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls={false} />

        {showBrush && (
          <Brush dataKey="date" height={22} travellerWidth={8} fill="#f0f2f5" stroke="#ccd0d5" tickFormatter={v => String(v).slice(0, 7)} />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
