import { memo, useMemo } from 'react';
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

const WeightChart = memo(function WeightChart({ data, height = 350, xInterval = 7 }: Props) {
  const chartData = useMemo(
    () => data.dates.map((d, i) => ({ date: d, weight: data.weights[i], sma7: data.sma7[i] })),
    [data.dates, data.weights, data.sma7],
  );

  const n          = data.dates.length;
  const showBrush  = n > 90;
  const yearStarts = useMemo(() => getYearStarts(data.dates), [data.dates]);
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
        <YAxis domain={[data.weight_min, data.weight_max]} tickFormatter={v => `${v}kg`} tick={{ fontSize: 11 }} width={52} />
        <Tooltip formatter={(v: number, name: string) => [`${v} kg`, name]} labelFormatter={fmt} />
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

        <Line type="monotone" dataKey="weight" name="体重" stroke="#1877f2" strokeWidth={2} dot={n > 90 ? false : { r: 3 }} activeDot={{ r: 5 }} />
        <Line type="monotone" dataKey="sma7" name="7日SMA" stroke="#ff7043" strokeWidth={2} strokeDasharray="5 5" dot={false} />

        {showBrush && (
          <Brush dataKey="date" height={22} travellerWidth={8} fill="#f0f2f5" stroke="#ccd0d5" tickFormatter={v => String(v).slice(0, 7)} />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
});

export default WeightChart;
