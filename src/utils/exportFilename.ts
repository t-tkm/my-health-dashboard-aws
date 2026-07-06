const STORAGE_KEY = 'csvExportHistory';

/** 今日の日付を YYYYMMDD 形式で返す */
function todayCompact(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/**
 * CSV エクスポート用ファイル名を生成する。
 * 同日内に複数回呼び出された場合、ブラウザの自動リネームに頼らず
 * 自前で連番（_1, _2, ...）を付与する。連番は localStorage に日付単位で保持し、
 * ページのリロードやタブの再オープンをまたいでも同日中は継続される。
 */
export function nextCsvExportFilename(baseName = 'health_data', ext = 'csv'): string {
  const today = todayCompact();
  let count = 0;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const history = raw ? JSON.parse(raw) : null;
    if (history && history.date === today && typeof history.count === 'number') {
      count = history.count + 1;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, count }));
  } catch {
    // localStorage が利用できない環境では連番なしのファイル名を返す
  }
  return count === 0 ? `${today}_${baseName}.${ext}` : `${today}_${baseName}_${count}.${ext}`;
}
