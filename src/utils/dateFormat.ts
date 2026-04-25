/** データ点数に応じた X 軸ラベルフォーマット */
export function formatTick(dateStr: string, totalCount: number): string {
  // 月次ラベルになる規模では年月を表示
  if (totalCount > 120) return dateStr.slice(0, 7).replace('-', '/'); // YYYY/MM
  return dateStr.slice(5).replace('-', '/'); // MM/DD
}

/** 1月1日に当たる日付を返す（年区切り線用） */
export function getYearStarts(dates: string[]): string[] {
  return dates.filter(d => d.slice(5) === '01-01');
}
