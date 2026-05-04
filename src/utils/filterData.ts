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
  const fBf    = daily(data.body_fat_percents);
  const fBfSma = daily(data.sma7_body_fat);

  const slopeStart = data.slope_dates.findIndex(d => d >= cutDate);
  const weekly = <T>(arr: T[]) => arr.slice(slopeStart >= 0 ? slopeStart : 0);

  const sma7Start = fSma7[0] ?? 0;
  const sma7End   = fSma7[fSma7.length - 1] ?? 0;

  const validBf       = fBf.filter((v): v is number => v !== null);
  const currentBf     = validBf.length > 0 ? validBf[validBf.length - 1] : null;
  const firstBfSmaIdx = fBfSma.findIndex(v => v !== null);
  const lastBfSmaIdx  = fBfSma.reduce<number>((acc, v, i) => v !== null ? i : acc, -1);
  const bfSmaStart    = firstBfSmaIdx >= 0 ? (fBfSma[firstBfSmaIdx] as number) : null;
  const bfSmaEnd      = lastBfSmaIdx  >= 0 ? (fBfSma[lastBfSmaIdx]  as number) : null;

  return {
    ...data,
    dates:                    fDates,
    weights:                  fW,
    calories:                 fCals,
    sma7:                     fSma7,
    body_fat_percents:        fBf,
    sma7_body_fat:            fBfSma,
    current_body_fat:         currentBf,
    sma7_body_fat_start:      bfSmaStart,
    sma7_body_fat_end:        bfSmaEnd,
    sma7_body_fat_start_date: firstBfSmaIdx >= 0 ? fDates[firstBfSmaIdx] : null,
    sma7_body_fat_end_date:   lastBfSmaIdx  >= 0 ? fDates[lastBfSmaIdx]  : null,
    body_fat_diff:            bfSmaStart !== null && bfSmaEnd !== null
                                ? Math.round((bfSmaStart - bfSmaEnd) * 10) / 10 : null,
    slope_dates:       weekly(data.slope_dates),
    slope_values:      weekly(data.slope_values),
    protein_gram:      daily(data.protein_gram),
    fat_gram:     daily(data.fat_gram),
    carb_gram:    daily(data.carb_gram),
    sugar_gram:   daily(data.sugar_gram),
    fiber_gram:   daily(data.fiber_gram),
    salt_gram:    daily(data.salt_gram),
    weight_min:   (() => { const v = fW.filter((w): w is number => w !== null); return v.length > 0 ? Math.round((Math.min(...v) - 1) * 10) / 10 : data.weight_min; })(),
    weight_max:   (() => { const v = fW.filter((w): w is number => w !== null); return v.length > 0 ? Math.round((Math.max(...v) + 1) * 10) / 10 : data.weight_max; })(),
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
