import { memo, useMemo } from 'react';
import {
  ComposedChart, Bar, Cell, Line, XAxis, YAxis, Tooltip, Legend,
  CartesianGrid, ResponsiveContainer,
} from 'recharts';
import { formatTick, formatTooltipDate } from '../utils/dateFormat';

interface Props {
  dates: string[];
  values: number[];
  target: number[];
  unit: string;
  height?: number;
  xInterval?: number;
  redWhen?: 'above' | 'below';
}

const NutrientChart = memo(function NutrientChart({ dates, values, target, unit, height = 280, xInterval = 7, redWhen = 'above' }: Props) {
  const chartData = useMemo(
    () => dates.map((d, i) => ({ date: d, value: values[i], target: target[i] ?? 0 })),
    [dates, values, target],
  );

  const n     = dates.length;
  const dense = n > 90;
  const fmt   = (dateStr: string) => formatTick(dateStr, n);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" angle={-45} textAnchor="end" tick={{ fontSize: 10 }} interval={xInterval} height={50} tickFormatter={fmt} />
        <YAxis domain={[0, 'auto']} tick={{ fontSize: 11 }} width={44} />
        <Tooltip formatter={(v: number, name: string) => [`${v} ${unit}`, name]} labelFormatter={formatTooltipDate} />
        <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 4 }} />
        <Bar
          dataKey="value"
          name={`摂取量 (${unit})`}
          fill="#1877f2"
          radius={dense ? [0, 0, 0, 0] : [2, 2, 0, 0]}
          opacity={dense ? 0.6 : 1}
          maxBarSize={dense ? 6 : 24}
        >
          {chartData.map((entry, i) => {
            const isRed = entry.target > 0 && (
              redWhen === 'above' ? entry.value > entry.target : entry.value < entry.target
            );
            return <Cell key={i} fill={isRed ? '#ef5350' : '#1877f2'} />;
          })}
        </Bar>
        <Line dataKey="target" name={`目安 (${unit})`} stroke="#ef5350" strokeWidth={2} strokeDasharray="6 3" dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
});

export default NutrientChart;
