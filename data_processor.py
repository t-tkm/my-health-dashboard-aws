import os
import numpy as np
import pandas as pd

_BASE = os.path.dirname(os.path.abspath(__file__))
DATA_CSV_PATH = os.path.join(_BASE, 'data.csv')

_COLS = [
    '日付', '体重',
    'カロリー', 'たんぱく質', '脂質', '炭水化物', '糖質', '食物繊維', '塩分',
    'カロリー(目安)', 'たんぱく質(目安)', '脂質(目安)', '炭水化物(目安)',
    '糖質(目安)', '食物繊維(目安)', '塩分(目安)',
]

_NUTRITION_MAP = {
    'calories':  'カロリー',
    'protein_g': 'たんぱく質',
    'fat_g':     '脂質',
    'carb_g':    '炭水化物',
    'sugar_g':   '糖質',
    'fiber_g':   '食物繊維',
    'salt_g':    '塩分',
}


def load_csv(source=DATA_CSV_PATH) -> pd.DataFrame:
    """CSV をファイルパスまたは file-like から読み込む。日付を YYYY-MM-DD に正規化する。"""
    try:
        df = pd.read_csv(source, encoding='utf-8-sig')
    except UnicodeDecodeError:
        if hasattr(source, 'seek'):
            source.seek(0)
        df = pd.read_csv(source, encoding='shift-jis')
    df['日付'] = pd.to_datetime(df['日付']).dt.strftime('%Y-%m-%d')
    return df.sort_values('日付').reset_index(drop=True)


def save_csv(df: pd.DataFrame, path: str = DATA_CSV_PATH) -> None:
    df.reindex(columns=_COLS).to_csv(path, index=False, encoding='utf-8-sig')


def import_csv(file_storage, path: str = DATA_CSV_PATH) -> None:
    save_csv(load_csv(file_storage), path)


def _rolling_slope(series: pd.Series, window: int = 30) -> list:
    slopes = []
    arr = series.values
    for i in range(len(arr)):
        start = max(0, i - window + 1)
        y = arr[start: i + 1]
        if len(y) < 2:
            slopes.append(None)
        else:
            x = np.arange(len(y))
            slopes.append(round(float(np.polyfit(x, y, 1)[0]), 4))
    return slopes


def compute(df: pd.DataFrame) -> dict:
    """CSV DataFrame から React 用 API dict を生成する。"""
    df = df.reindex(columns=_COLS).copy()

    def last_val(col: str) -> float:
        vals = df[col].dropna()
        return round(float(vals.iloc[-1]), 1) if len(vals) > 0 else 0

    cal_target     = last_val('カロリー(目安)')
    protein_target = last_val('たんぱく質(目安)')
    fat_target     = last_val('脂質(目安)')
    carb_target    = last_val('炭水化物(目安)')
    sugar_target   = last_val('糖質(目安)')
    fiber_target   = last_val('食物繊維(目安)')
    salt_target    = last_val('塩分(目安)')

    df['体重'] = pd.to_numeric(df['体重'], errors='coerce').interpolate(method='linear')
    df = df.fillna(0)

    weights  = df['体重'].round(1).tolist()
    calories = df['カロリー'].tolist()
    sma7     = df['体重'].rolling(window=7, min_periods=1).mean().round(2).tolist()

    all_slopes = _rolling_slope(df['体重'], window=30)
    weekly_idx = list(range(6, len(df), 7))
    if len(df) - 1 not in weekly_idx:
        weekly_idx.append(len(df) - 1)

    return {
        'dates':        df['日付'].tolist(),
        'weights':      weights,
        'calories':     calories,
        'sma7':         sma7,
        'slope_dates':  [df['日付'].iloc[i] for i in weekly_idx],
        'slope_values': [all_slopes[i] for i in weekly_idx],
        'protein_gram': df['たんぱく質'].round(1).tolist(),
        'fat_gram':     df['脂質'].round(1).tolist(),
        'carb_gram':    df['炭水化物'].round(1).tolist(),
        'sugar_gram':   df['糖質'].round(1).tolist(),
        'fiber_gram':   df['食物繊維'].round(1).tolist(),
        'salt_gram':    df['塩分'].round(1).tolist(),
        'cal_target':     cal_target,
        'protein_target': protein_target,
        'fat_target':     fat_target,
        'carb_target':    carb_target,
        'sugar_target':   sugar_target,
        'fiber_target':   fiber_target,
        'salt_target':    salt_target,
        'current_weight':  float(round(weights[-1], 1)),
        'sma7_start':      float(round(sma7[0], 1)),
        'sma7_end':        float(round(sma7[-1], 1)),
        'sma7_start_date': df['日付'].iloc[0],
        'sma7_end_date':   df['日付'].iloc[-1],
        'weight_diff':     float(round(sma7[0] - sma7[-1], 1)),
        'avg_cal':         int(sum(calories) / len(calories)) if calories else 0,
        'record_days':     int(len(df)),
        'weight_min':      float(round(min(weights) - 1, 1)),
        'weight_max':      float(round(max(weights) + 1, 1)),
    }


def delete_entry(date: str, path: str = DATA_CSV_PATH) -> dict:
    df = load_csv(path)
    df = df[df['日付'] != date].reset_index(drop=True)
    save_csv(df, path)
    return compute(df)


def add_entry(
    date: str,
    weight: float | None = None,
    nutrition: dict | None = None,
    path: str = DATA_CSV_PATH,
) -> dict:
    """1日分を追加/更新して保存し compute() の結果を返す。"""
    df = load_csv(path)

    if date in df['日付'].values:
        idx = df.index[df['日付'] == date][0]
        if weight is not None:
            df.loc[idx, '体重'] = weight
        if nutrition:
            for key, col in _NUTRITION_MAP.items():
                if key in nutrition:
                    df.loc[idx, col] = nutrition[key]
    else:
        last = df.iloc[-1]
        new_row: dict = {'日付': date, '体重': weight}
        if nutrition:
            for key, col in _NUTRITION_MAP.items():
                new_row[col] = nutrition.get(key)
        for col in _COLS:
            if col.endswith('(目安)'):
                v = last[col] if col in last.index else None
                new_row.setdefault(col, float(v) if pd.notna(v) else 0)
        df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
        df = df.sort_values('日付').reset_index(drop=True)

    save_csv(df, path)
    return compute(df)
