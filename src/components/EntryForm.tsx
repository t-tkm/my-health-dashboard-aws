import { useState } from 'react';
import { HealthData } from '../types';

interface Props {
  data: HealthData | null;
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  date: string;
  weight: string;
  calories: string;
  protein_g: string;
  fat_g: string;
  carb_g: string;
  sugar_g: string;
  fiber_g: string;
  salt_g: string;
}

const EMPTY_NUTRITION: Omit<FormState, 'date' | 'weight'> = {
  calories: '', protein_g: '', fat_g: '', carb_g: '', sugar_g: '', fiber_g: '', salt_g: '',
};

function today(): string {
  return new Date().toLocaleDateString('sv-SE');
}

function numStr(v: number): string {
  return v !== 0 ? String(v) : '';
}

function valuesForDate(data: HealthData | null, date: string): Omit<FormState, 'date'> {
  const blank = { weight: '', ...EMPTY_NUTRITION };
  if (!data) return blank;
  const idx = data.dates.indexOf(date);
  if (idx === -1) return blank;
  return {
    weight:    numStr(data.weights[idx]),
    calories:  numStr(data.calories[idx]),
    protein_g: numStr(data.protein_gram[idx]),
    fat_g:     numStr(data.fat_gram[idx]),
    carb_g:    numStr(data.carb_gram[idx]),
    sugar_g:   numStr(data.sugar_gram[idx]),
    fiber_g:   numStr(data.fiber_gram[idx]),
    salt_g:    numStr(data.salt_gram[idx]),
  };
}

function parseOptional(v: string): number | undefined {
  const n = parseFloat(v);
  return isNaN(n) ? undefined : n;
}

export default function EntryForm({ data, onClose, onSaved }: Props) {
  const initialDate = today();
  const [form, setForm] = useState<FormState>({
    date: initialDate,
    ...valuesForDate(data, initialDate),
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleDateChange(newDate: string) {
    setForm({ date: newDate, ...valuesForDate(data, newDate) });
    setError(null);
  }

  function set(field: keyof FormState, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  const hasExisting = data?.dates.includes(form.date) ?? false;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const body: Record<string, unknown> = { date: form.date };
    const w = parseOptional(form.weight);
    if (w !== undefined) body.weight = w;

    const nutritionKeys = ['calories', 'protein_g', 'fat_g', 'carb_g', 'sugar_g', 'fiber_g', 'salt_g'] as const;
    for (const k of nutritionKeys) {
      const v = parseOptional(form[k]);
      if (v !== undefined) body[k] = v;
    }

    const allEmpty = !body.weight && nutritionKeys.every(k => !(k in body));

    if (allEmpty && !hasExisting) {
      setError('体重か栄養素のどちらかを入力してください');
      return;
    }

    if (allEmpty && hasExisting) {
      if (!window.confirm(`${form.date} のデータを削除しますか？`)) return;
      setSubmitting(true);
      try {
        const res = await fetch('/api/entry', {
          method: 'DELETE',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: form.date }),
        });
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? 'エラーが発生しました'); return; }
        onSaved();
        onClose();
      } catch {
        setError('通信エラーが発生しました');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/entry', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'エラーが発生しました'); return; }
      onSaved();
      onClose();
    } catch {
      setError('通信エラーが発生しました');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">データを入力</h2>
          <button className="modal-close" onClick={onClose} aria-label="閉じる">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="entry-form" noValidate>
          <p className="form-hint">
            {hasExisting
              ? '既存のデータを読み込みました。変更したい項目だけ編集してください。すべて空にして保存するとこの日のデータを削除します。'
              : '入力したい項目だけ記入してください。空欄の項目は変更されません。'}
          </p>

          <div className="form-group">
            <label>日付 <span className="required">*</span></label>
            <input type="date" value={form.date}
              onChange={e => handleDateChange(e.target.value)} required />
          </div>

          <div className="form-section-label">体重 <span className="form-optional">省略可</span></div>
          <div className="form-row">
            <div className="form-group">
              <label>体重 (kg)</label>
              <input type="number" step="0.1" placeholder="例: 70.5"
                value={form.weight} onChange={e => set('weight', e.target.value)} />
            </div>
          </div>

          <div className="form-section-label">食事 <span className="form-optional">省略可・一部のみも可</span></div>
          <div className="form-row">
            <div className="form-group">
              <label>カロリー (kcal)</label>
              <input type="number" step="1" placeholder="例: 2000"
                value={form.calories} onChange={e => set('calories', e.target.value)} />
            </div>
            <div className="form-group">
              <label>タンパク質 (g)</label>
              <input type="number" step="0.1" placeholder="例: 150"
                value={form.protein_g} onChange={e => set('protein_g', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>脂質 (g)</label>
              <input type="number" step="0.1" placeholder="例: 60"
                value={form.fat_g} onChange={e => set('fat_g', e.target.value)} />
            </div>
            <div className="form-group">
              <label>炭水化物 (g)</label>
              <input type="number" step="0.1" placeholder="例: 250"
                value={form.carb_g} onChange={e => set('carb_g', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>糖質 (g)</label>
              <input type="number" step="0.1" placeholder="例: 200"
                value={form.sugar_g} onChange={e => set('sugar_g', e.target.value)} />
            </div>
            <div className="form-group">
              <label>食物繊維 (g)</label>
              <input type="number" step="0.1" placeholder="例: 20"
                value={form.fiber_g} onChange={e => set('fiber_g', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>塩分 (g)</label>
              <input type="number" step="0.1" placeholder="例: 5"
                value={form.salt_g} onChange={e => set('salt_g', e.target.value)} />
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="form-actions">
            <button type="button" className="btn" onClick={onClose}>キャンセル</button>
            <button type="submit" className="btn btn-save" disabled={submitting}>
              {submitting ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
