import { HealthData } from '../types';

export type RangeDays = 30 | 90 | 180 | 365 | null;

export function filterData(data: HealthData, days: RangeDays): HealthData {
  if (!days || days >= data.dates.length) return data;

  const startIdx = data.dates.length - days;
  const cutDate  = data.dates[startIdx];

  const daily  = <T>(arr: T[]) => arr.slice(startIdx);
  const fDates = daily(data.dates);
  const fW     = daily(data.weights);
  const fSma7  = daily(data.sma7);
  const fCals  = daily(data.calories);

  const slopeStart = data.slope_dates.findIndex(d => d >= cutDate);
  const weekly = <T>(arr: T[]) => arr.slice(slopeStart >= 0 ? slopeStart : 0);

  const sma7Start = fSma7[0] ?? 0;
  const sma7End   = fSma7[fSma7.length - 1] ?? 0;

  return {
    ...data,
    dates:        fDates,
    weights:      fW,
    calories:     fCals,
    sma7:         fSma7,
    slope_dates:  weekly(data.slope_dates),
    slope_values: weekly(data.slope_values),
    protein_gram: daily(data.protein_gram),
    fat_gram:     daily(data.fat_gram),
    carb_gram:    daily(data.carb_gram),
    sugar_gram:   daily(data.sugar_gram),
    fiber_gram:   daily(data.fiber_gram),
    salt_gram:    daily(data.salt_gram),
    weight_min:   Math.round((Math.min(...fW) - 1) * 10) / 10,
    weight_max:   Math.round((Math.max(...fW) + 1) * 10) / 10,
    sma7_start:      Math.round(sma7Start * 10) / 10,
    sma7_end:        Math.round(sma7End   * 10) / 10,
    sma7_start_date: fDates[0],
    sma7_end_date:   fDates[fDates.length - 1],
    weight_diff:     Math.round((sma7Start - sma7End) * 10) / 10,
    avg_cal:    fCals.length > 0 ? Math.round(fCals.reduce((a, b) => a + b, 0) / fCals.length) : 0,
    record_days: fDates.length,
  };
}

/** データ点数に応じた X 軸ラベル間隔を返す */
export function xInterval(count: number): number {
  if (count > 270) return 30;   // 月次 ≈12本
  if (count > 120) return 14;   // 隔週 ≈9本
  if (count > 60)  return 7;    // 週次 ≈9本
  if (count > 30)  return 4;
  return 2;
}
