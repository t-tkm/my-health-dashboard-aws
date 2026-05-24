import { useState } from 'react';
import { apiFetch } from '../hooks/useHealthData';

const LOG_TYPES: { value: string; label: string }[] = [
  { value: 'api-gateway',       label: 'API Gateway アクセスログ' },
  { value: 'lambda-data',       label: 'Lambda: データ取得' },
  { value: 'lambda-entry',      label: 'Lambda: エントリ登録/削除' },
  { value: 'lambda-export',     label: 'Lambda: CSVエクスポート' },
  { value: 'lambda-importcsv',  label: 'Lambda: CSVインポート' },
  { value: 'lambda-preauth',    label: 'Lambda: 認証前トリガー' },
  { value: 'lambda-postauth',   label: 'Lambda: 認証後トリガー' },
];

function today(): string {
  return new Date().toLocaleDateString('sv-SE');
}

function monthAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toLocaleDateString('sv-SE');
}

export default function LogDownload() {
  const [open, setOpen] = useState(false);
  const [logType, setLogType] = useState(LOG_TYPES[0].value);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/logs?type=${logType}&from=${from}&to=${to}`);
      if (!res.ok) {
        const msg = await res.text();
        alert(`ログダウンロードエラー: ${msg}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `logs_${logType}_${from}_${to}.ndjson`;
      a.click();
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch (e) {
      alert(`ログダウンロードエラー: ${e}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button className="btn" onClick={() => setOpen(o => !o)}>ログDL</button>
      {open && (
        <div style={{
          position: 'absolute', top: '110%', right: 0, zIndex: 100,
          background: '#fff', border: '1px solid #ddd', borderRadius: 8,
          padding: '16px', minWidth: 280, boxShadow: '0 4px 12px rgba(0,0,0,.12)',
        }}>
          <div style={{ marginBottom: 10, fontWeight: 600, fontSize: 14 }}>ログダウンロード</div>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>ログ種別</label>
          <select value={logType} onChange={e => setLogType(e.target.value)}
            style={{ width: '100%', marginBottom: 10, padding: '4px 6px', borderRadius: 4, border: '1px solid #ccc' }}>
            {LOG_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>開始日</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            style={{ width: '100%', marginBottom: 10, padding: '4px 6px', borderRadius: 4, border: '1px solid #ccc' }} />
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>終了日（最大31日）</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            style={{ width: '100%', marginBottom: 12, padding: '4px 6px', borderRadius: 4, border: '1px solid #ccc' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={handleDownload} disabled={loading} style={{ flex: 1 }}>
              {loading ? 'ダウンロード中...' : 'ダウンロード'}
            </button>
            <button className="btn" onClick={() => setOpen(false)} style={{ flex: 1 }}>キャンセル</button>
          </div>
        </div>
      )}
    </div>
  );
}
