import { memo, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  CartesianGrid, ResponsiveContainer, Brush, ReferenceLine,
} from 'recharts';
import { HealthData } from '../types';
import { formatTick, formatTickWithDow, getYearStarts } from '../utils/dateFormat';

interface Props {
  data: HealthData;
  height?: number;
  xInterval?: number;
}

const EXERCISE_COLOR: Record<string, string> = {
  g:  '#1877f2',
  h:  '#42b72a',
  gh: '#f5a623',
};

const EXERCISE_LABEL: Record<string, string> = {
  g:  'ジム',
  h:  'HIIT',
  gh: 'ジム+HIIT',
};

function ExerciseDot(props: { cx?: number; cy?: number; payload?: { exercise?: string | null }; value?: number }) {
  const { cx, cy, payload, value } = props;
  if (!payload?.exercise || value == null || cx == null || cy == null) return null;
  const color = EXERCISE_COLOR[payload.exercise];
  if (!color) return null;
  return <circle cx={cx} cy={cy} r={6} fill={color} stroke="#fff" strokeWidth={1.5} />;
}

const WeightChart = memo(function WeightChart({ data, height = 350, xInterval = 7 }: Props) {
  const chartData = useMemo(
    () => data.dates.map((d, i) => ({
      date: d,
      weight: data.weights[i],
      sma7: data.sma7[i],
      exercise: data.exercises[i] ?? null,
    })),
    [data.dates, data.weights, data.sma7, data.exercises],
  );

  const n          = data.dates.length;
  const showBrush  = n > 90;
  const yearStarts = useMemo(() => getYearStarts(data.dates), [data.dates]);
  const fmt = (dateStr: string) => formatTick(dateStr, n);

  const exercisePayloads = useMemo(() => {
    const seen = new Set<string>();
    data.exercises.forEach(e => { if (e && EXERCISE_COLOR[e]) seen.add(e); });
    return [...seen].map(e => ({ value: EXERCISE_LABEL[e] ?? e, type: 'circle' as const, color: EXERCISE_COLOR[e] }));
  }, [data.exercises]);

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
        <Tooltip
          formatter={(v: number, name: string) => [`${v} kg`, name]}
          labelFormatter={formatTickWithDow}
        />
        <Legend
          verticalAlign="top"
          wrapperStyle={{ paddingBottom: 4 }}
          payload={[
            { value: '体重',  type: 'line',   color: '#1877f2' },
            { value: '7日SMA', type: 'line',  color: '#ff7043' },
            ...exercisePayloads,
          ]}
        />

        {yearStarts.map(d => (
          <ReferenceLine
            key={d}
            x={d}
            stroke="#aaa"
            strokeWidth={1.5}
            label={{ value: d.slice(0, 4), position: 'insideTopRight', fontSize: 11, fill: '#888', fontWeight: 700 }}
          />
        ))}

        <Line
          type="monotone"
          dataKey="weight"
          name="体重"
          stroke="#1877f2"
          strokeWidth={2}
          dot={<ExerciseDot />}
          activeDot={{ r: 5 }}
        />
        <Line type="monotone" dataKey="sma7" name="7日SMA" stroke="#ff7043" strokeWidth={2} strokeDasharray="5 5" dot={false} />

        {showBrush && (
          <Brush dataKey="date" height={22} travellerWidth={8} fill="#f0f2f5" stroke="#ccd0d5" tickFormatter={v => String(v).slice(0, 7)} />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
});

export default WeightChart;
