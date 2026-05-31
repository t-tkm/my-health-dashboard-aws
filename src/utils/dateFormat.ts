const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** YYYY-MM-DD → 曜日3文字 */
export function getDow(dateStr: string): string {
  return DOW[new Date(dateStr + 'T00:00:00').getDay()];
}

/** データ点数に応じた X 軸ラベルフォーマット */
export function formatTick(dateStr: string, totalCount: number): string {
  // 月次ラベルになる規模では年月を表示
  if (totalCount > 120) return dateStr.slice(0, 7).replace('-', '/'); // YYYY/MM
  return formatTickWithDow(dateStr); // MM/DD(Dow)
}

/** ツールチップ用: MM/DD(Dow) */
export function formatTickWithDow(dateStr: string): string {
  return `${dateStr.slice(5).replace('-', '/')}(${getDow(dateStr)})`;
}

/** 1月1日に当たる日付を返す（年区切り線用） */
export function getYearStarts(dates: string[]): string[] {
  return dates.filter(d => d.slice(5) === '01-01');
}
