interface Props {
  fileName: string;
  busy: boolean;
  onBackupAndImport: () => void;
  onImport: () => void;
  onCancel: () => void;
}

/** CSV で置き換える前の確認。既存データが消えるので、その場でバックアップできるようにする */
export default function ImportConfirmDialog({ fileName, busy, onBackupAndImport, onImport, onCancel }: Props) {
  return (
    <div className="modal-overlay" onClick={busy ? undefined : onCancel}>
      <div className="modal" role="alertdialog" aria-labelledby="import-confirm-title" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title" id="import-confirm-title">CSVで置き換える</h2>
          <button className="modal-close" onClick={onCancel} disabled={busy} aria-label="閉じる">✕</button>
        </div>
        <div className="import-confirm">
          <p>
            現在のデータを「<b>{fileName}</b>」の内容で置き換えます。<br />
            CSV にない日付のデータは削除され、元に戻せません。
          </p>
          <p>置き換える前に、現在のデータをバックアップ（CSV でダウンロード）しますか？</p>
          <div className="form-actions import-confirm-actions">
            <button type="button" className="btn" onClick={onCancel} disabled={busy}>キャンセル</button>
            <button type="button" className="btn" onClick={onImport} disabled={busy}>バックアップせずに置き換える</button>
            <button type="button" className="btn btn-save" onClick={onBackupAndImport} disabled={busy} autoFocus>
              {busy ? '処理中...' : 'バックアップしてから置き換える'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
