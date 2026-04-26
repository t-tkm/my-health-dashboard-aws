import { useEffect, useMemo, useState } from 'react';
import { useAuthenticator, Authenticator } from '@aws-amplify/ui-react';
import { useHealthData, apiFetch } from './hooks/useHealthData';
import { filterData, xInterval, RangeDays } from './utils/filterData';
import StatCard from './components/StatCard';
import RangeFilter from './components/RangeFilter';
import WeightChart from './components/WeightChart';
import SlopeChart from './components/SlopeChart';
import NutrientChart from './components/NutrientChart';
import EmptyState from './components/EmptyState';
import EntryForm from './components/EntryForm';
import { apiEndpoint } from './aws-config';

function useIsMobile(breakpoint = 600) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < breakpoint);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [breakpoint]);
  return isMobile;
}

function Dashboard() {
  const { signOut, user } = useAuthenticator();
  const { data, loading, error, isEmpty, refresh } = useHealthData();
  const isMobile = useIsMobile();
  const [range, setRange] = useState<RangeDays>(null);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [importing, setImporting] = useState(false);

  const filtered = useMemo(
    () => (data ? filterData(data, range) : null),
    [data, range],
  );

  async function handleCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const res = await apiFetch('/api/import', { method: 'POST', body: buf,
        headers: { 'Content-Type': 'text/csv' } });
      if (!res.ok) throw new Error(await res.text());
      refresh();
    } catch (err) {
      alert(`CSVインポートエラー: ${err}`);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  }

  if (loading) return <div className="center-message">読み込み中...</div>;

  if (error || isEmpty || !data || !filtered) return (
    <div className="dashboard">
      {showEntryForm && (
        <EntryForm data={null} onClose={() => setShowEntryForm(false)} onSaved={refresh} />
      )}
      <header className="header">
        <h1>健康管理分析ダッシュボード</h1>
        <div className="header-actions">
          <button className="btn btn-entry" onClick={() => setShowEntryForm(true)}>データを入力する</button>
          <label className="btn" style={{ cursor: 'pointer' }}>
            {importing ? 'インポート中...' : 'CSVをインポートする'}
            <input type="file" accept=".csv" hidden onChange={handleCsvImport} disabled={importing} />
          </label>
          <button className="btn" onClick={signOut} title={user?.signInDetails?.loginId}>ログアウト</button>
        </div>
      </header>
      <EmptyState error={error} />
    </div>
  );


  const diff = filtered.weight_diff;
  const n    = filtered.dates.length;
  const xi   = xInterval(n);

  const h = isMobile
    ? { weight: 240, slope: 190, cal: 250, nutrient: 210 }
    : { weight: 380, slope: 300, cal: 320, nutrient: 280 };

  return (
    <div className="dashboard">
      {showEntryForm && (
        <EntryForm data={data} onClose={() => setShowEntryForm(false)} onSaved={refresh} />
      )}
      <header className="header">
        <h1>健康管理分析ダッシュボード</h1>
        <div className="header-actions">
          <a href={`${apiEndpoint.replace(/\/$/, '')}/api/export`} download="health_data.csv" className="btn btn-export">CSVエクスポート</a>
          <button className="btn btn-entry" onClick={() => setShowEntryForm(true)}>データを入力する</button>
          <label className="btn" style={{ cursor: 'pointer' }}>
            {importing ? 'インポート中...' : 'CSVで更新する'}
            <input type="file" accept=".csv" hidden onChange={handleCsvImport} disabled={importing} />
          </label>
          <button className="btn" onClick={signOut} title={user?.signInDetails?.loginId}>ログアウト</button>
        </div>
      </header>

      <div className="stat-grid">
        <StatCard
          label="最新の体重"
          value={`${data.current_weight} kg`}
          color="#1877f2"
          sub={<>
            {diff > 0
              ? <span className="text-green fw-bold">▼ {diff} kg 減量（期間内SMA）</span>
              : diff < 0
              ? <span className="text-red fw-bold">▲ {Math.abs(diff)} kg 増量（期間内SMA）</span>
              : <span className="text-muted">変化なし</span>}
            <span className="block text-muted mt-1">
              {filtered.sma7_start_date}: <b>{filtered.sma7_start} kg</b>
              {' → '}
              {filtered.sma7_end_date}: <b>{filtered.sma7_end} kg</b>
            </span>
          </>}
        />
        <StatCard
          label="平均摂取カロリー"
          value={`${filtered.avg_cal} kcal`}
          color="#42b72a"
          sub={<span className="text-muted">目標: {data.cal_target} kcal</span>}
        />
        <StatCard
          label="表示期間"
          value={`${filtered.record_days} 日間`}
          color="#f02849"
          sub={<span className="text-muted">全 {data.record_days} 日間のデータ</span>}
        />
      </div>

      <RangeFilter value={range} totalDays={data.record_days} onChange={setRange} />

      <div className="section-header">体重</div>

      <div className="chart-card">
        <div className="chart-title">体重推移（7日SMA付き）</div>
        <p className="chart-note">
          <b>7日SMA（単純移動平均）</b>とは、その日を含む直近7日間の体重の平均値です。
          日々の測定誤差や食事・排泄タイミングによるブレを平滑化し、体重の本質的なトレンドを把握しやすくします。
          {n > 90 && <> グラフ下部のスライダーで表示範囲を絞り込めます。</>}
        </p>
        <WeightChart data={filtered} height={h.weight} xInterval={xi} />
      </div>

      <div className="chart-card">
        <div className="chart-title">体重の増減ペース（週ごとの傾向）</div>
        <p className="chart-note">
          各週時点での<b>直近30日間の体重データに線形回帰</b>を当てはめ、1日あたりの変化量（傾き）を算出。
          それを7倍して「週あたり何kg増減しているか」に換算しています。
          短期的なブレに左右されず、実際のトレンドを捉えます。
          <b className="text-green"> 緑（マイナス）= 減量中</b>、
          <b className="text-red"> 赤（プラス）= 増量中</b>。
        </p>
        <SlopeChart data={filtered} height={h.slope} xInterval={Math.max(1, Math.floor(xi / 7))} />
      </div>

      <div className="section-header">食事</div>

      <div className="chart-card">
        <div className="chart-title">カロリー</div>
        <NutrientChart dates={filtered.dates} values={filtered.calories} target={data.cal_target} unit="kcal" height={h.cal} xInterval={xi} />
      </div>

      <div className="chart-grid-2">
        <div className="chart-card">
          <div className="chart-title">タンパク質</div>
          <NutrientChart dates={filtered.dates} values={filtered.protein_gram} target={data.protein_target} unit="g" height={h.nutrient} xInterval={xi} />
        </div>
        <div className="chart-card">
          <div className="chart-title">脂質</div>
          <NutrientChart dates={filtered.dates} values={filtered.fat_gram} target={data.fat_target} unit="g" height={h.nutrient} xInterval={xi} />
        </div>
      </div>

      <div className="chart-grid-2">
        <div className="chart-card">
          <div className="chart-title">炭水化物</div>
          <NutrientChart dates={filtered.dates} values={filtered.carb_gram} target={data.carb_target} unit="g" height={h.nutrient} xInterval={xi} />
        </div>
        <div className="chart-card">
          <div className="chart-title">糖質</div>
          <NutrientChart dates={filtered.dates} values={filtered.sugar_gram} target={data.sugar_target} unit="g" height={h.nutrient} xInterval={xi} />
        </div>
      </div>

      <div className="chart-grid-2">
        <div className="chart-card">
          <div className="chart-title">食物繊維</div>
          <NutrientChart dates={filtered.dates} values={filtered.fiber_gram} target={data.fiber_target} unit="g" height={h.nutrient} xInterval={xi} />
        </div>
        <div className="chart-card">
          <div className="chart-title">塩分</div>
          <NutrientChart dates={filtered.dates} values={filtered.salt_gram} target={data.salt_target} unit="g" height={h.nutrient} xInterval={xi} />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Authenticator>
      {() => <Dashboard />}
    </Authenticator>
  );
}
