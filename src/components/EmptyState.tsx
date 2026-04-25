interface Props { error?: string | null }

export default function EmptyState({ error }: Props) {
  return (
    <div className="empty-state">
      <svg className="empty-icon" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="8"  y="52" width="18" height="36" rx="4" fill="#1877f2" opacity="0.25"/>
        <rect x="33" y="28" width="18" height="60" rx="4" fill="#1877f2" opacity="0.55"/>
        <rect x="58" y="8"  width="18" height="80" rx="4" fill="#1877f2"/>
        <line x1="4" y1="92" x2="92" y2="92" stroke="#1877f2" strokeWidth="3" strokeLinecap="round" opacity="0.4"/>
      </svg>

      {error ? (
        <>
          <h2 className="empty-title">エラーが発生しました</h2>
          <p className="empty-desc">{error}</p>
        </>
      ) : (
        <>
          <h2 className="empty-title">データがありません</h2>
          <p className="empty-desc">
            Excelファイル（.xlsx）をアップロードして<br />
            ダッシュボードを表示しましょう。
          </p>
        </>
      )}

      <a href="/upload" className="btn-primary">
        {error ? '再アップロードする' : 'データをアップロードする'}
      </a>
    </div>
  );
}
