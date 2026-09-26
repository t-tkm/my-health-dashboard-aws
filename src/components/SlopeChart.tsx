import { memo, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine,
  ResponsiveContainer, Cell,
} from 'recharts';
import { HealthData } from '../types';
import { formatTick, formatTooltipDate } from '../utils/dateFormat';

interface Props {
  data: HealthData;
  height?: number;
  xInterval?: number;
}

const SlopeChart = memo(function SlopeChart({ data, height = 300, xInterval = 4 }: Props) {
  const chartData = useMemo(
    () => data.slope_dates.map((d, i) => {
      const raw = data.slope_values[i];
      return { date: d, slope: raw !== null ? Math.round(raw * 7 * 100) / 100 : null };
    }),
    [data.slope_dates, data.slope_values],
  );

  const n   = data.slope_dates.length;
  const fmt = (dateStr: string) => formatTick(dateStr, n * 7); // 週次→日次換算で判定
  const fmtVal = (v: number) => (v > 0 ? '+' : '') + v + ' kg';

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 40 }}>
        <XAxis dataKey="date" angle={-45} textAnchor="end" tick={{ fontSize: 10 }} interval={xInterval} height={50} tickFormatter={fmt} />
        <YAxis tickFormatter={v => (v > 0 ? '+' : '') + v + 'kg'} tick={{ fontSize: 11 }} width={52} />
        <Tooltip formatter={(v: number) => [fmtVal(v), '週あたり体重変化']} labelFormatter={(d: string) => `${formatTooltipDate(d)} 時点`} />
        <ReferenceLine y={0} stroke="#999" strokeDasharray="4 4" />
        <Bar dataKey="slope" name="週あたり体重変化" radius={[3, 3, 0, 0]}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={(entry.slope ?? 0) < 0 ? '#2ecc71' : '#e74c3c'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});

export default SlopeChart;
