const DOW = ['日', '月', '火', '水', '木', '金', '土'];

/** YYYY-MM-DD → 曜日（日本語1文字） */
export function getDow(dateStr: string): string {
  return DOW[new Date(dateStr + 'T00:00:00').getDay()];
}

/** データ点数に応じた X 軸ラベルフォーマット */
export function formatTick(dateStr: string, totalCount: number): string {
  // 目盛りが間引かれる規模では曜日を省いて MM/DD だけにする
  // （年月だけにすると約2週間ごとの目盛りで同じ月が2回並ぶ）
  if (totalCount > 120) return dateStr.slice(5).replace('-', '/'); // MM/DD
  return formatTickWithDow(dateStr); // MM/DD(Dow)
}

/** X 軸用: MM/DD(曜) */
export function formatTickWithDow(dateStr: string): string {
  return `${dateStr.slice(5).replace('-', '/')}(${getDow(dateStr)})`;
}

/** ツールチップ用: YYYY/MM/DD(曜) */
export function formatTooltipDate(dateStr: string): string {
  return `${dateStr.replace(/-/g, '/')}(${getDow(dateStr)})`;
}

/** ツールチップの値を小数1桁にそろえる（SMA は小数2桁で届くため） */
export function formatOneDecimal(v: unknown): string {
  return typeof v === 'number' ? v.toFixed(1) : String(v);
}

/** 1月1日に当たる日付を返す（年区切り線用） */
export function getYearStarts(dates: string[]): string[] {
  return dates.filter(d => d.slice(5) === '01-01');
}
