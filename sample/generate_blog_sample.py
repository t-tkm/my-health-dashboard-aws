#!/usr/bin/env python3
"""公開記事のスクリーンショット用ダミーデータを生成する。

- 期間: 2026/4/1〜2026/9/30
- 体重: 75.0kg スタートで、毎月 0.5kg ずつ減る（日々のブレ・週末の増加あり）
- 列構成・欠損の割合・値の幅は実データ（非公開）の傾向に合わせているが、値そのものは乱数で生成している
- アプリの「CSVで置き換える」でそのまま取り込める形式（CSV エクスポートと同じ列）

Usage:
    python3 sample/generate_blog_sample.py
"""
import csv
import math
import random
from datetime import date, timedelta
from pathlib import Path

random.seed(20260401)

START = date(2026, 4, 1)
END = date(2026, 9, 30)
WEIGHT_START = 75.0
WEIGHT_LOSS_PER_MONTH = 0.5
BF_START = 24.0
BF_LOSS_PER_MONTH = 0.25
DAYS_PER_MONTH = 30.4

# 目安値は 6/1 に一度だけ見直した想定（グラフの目安ラインに段差が出る）
TARGETS_BEFORE = dict(cal_target=1500, protein_target=110, fat_target=70, carb_target=110,
                      sugar_target=89, fiber_target=21, salt_target=7.5)
TARGETS_AFTER = dict(cal_target=1500, protein_target=120, fat_target=65, carb_target=105,
                     sugar_target=85, fiber_target=22, salt_target=7.5)
TARGET_CHANGE = date(2026, 6, 1)

# 食事の記録が途切れた期間（旅行など）。平均カロリーの「記録なし」表示の確認用
MEAL_GAPS = [(date(2026, 8, 10), date(2026, 8, 16)), (date(2026, 9, 21), date(2026, 9, 30))]

FIELDS = ['date', 'day_of_week', 'weight', 'body_fat_percent', 'exercise', 'calories', 'protein_g',
          'fat_g', 'carb_g', 'sugar_g', 'fiber_g', 'salt_g', 'cal_target', 'protein_target',
          'fat_target', 'carb_target', 'sugar_target', 'fiber_target', 'salt_target']
DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def in_gap(d: date) -> bool:
    return any(a <= d <= b for a, b in MEAL_GAPS)


def main() -> None:
    rows = []
    d = START
    prev_feast = False
    while d <= END:
        i = (d - START).days
        months = i / DAYS_PER_MONTH
        weekend = d.weekday() >= 5
        row = {'date': f'{d.year}/{d.month}/{d.day}', 'day_of_week': DOW[d.weekday()]}

        # 体重: 直線トレンド + ゆっくりした揺らぎ + 日々のブレ。月曜は週末の食べ過ぎで少し重い
        trend = WEIGHT_START - WEIGHT_LOSS_PER_MONTH * months
        wave = 0.1 * math.sin(i / 5.0)
        bump = 0.3 if d.weekday() == 0 else (0.15 if prev_feast else 0.0)
        if random.random() > 0.05:
            row['weight'] = round(trend + wave + bump + random.gauss(0, 0.3), 1)

        # 体脂肪率: 体重と同じ向きにゆっくり下がる。未記録は 15% 程度
        if random.random() > 0.15:
            row['body_fat_percent'] = round(BF_START - BF_LOSS_PER_MONTH * months + random.gauss(0, 0.45), 1)

        # 運動: 週末は多め。ジム(g) / HIIT(h) / 両方(gh)
        if random.random() < (0.35 if weekend else 0.12):
            r = random.random()
            row['exercise'] = 'g' if r < 0.55 else ('h' if r < 0.93 else 'gh')

        # 食事: 未記録は途切れ期間 + ランダムで全体の 25% 前後。たまに食べ過ぎの日がある
        prev_feast = False
        if not in_gap(d) and random.random() > 0.18:
            feast = weekend and random.random() < 0.15
            prev_feast = feast
            cal = random.uniform(2600, 3400) if feast else clamp(random.gauss(1550, 320), 700, 2600)
            scale = cal / 1550
            protein = clamp(random.gauss(100, 22) * scale ** 0.6, 30, 200)
            fat = clamp(random.gauss(70, 18) * scale, 10, 180)
            carb = clamp((cal - protein * 4 - fat * 9) / 4, 20, 450)
            fiber = clamp(random.gauss(17, 5), 3, 40)
            row.update(
                calories=round(cal),
                protein_g=round(protein, 1),
                fat_g=round(fat, 1),
                carb_g=round(carb, 1),
                sugar_g=round(max(carb - fiber, 5), 1),
                fiber_g=round(fiber, 1),
                salt_g=round(clamp(random.gauss(7.0, 2.2) * scale ** 0.5, 1.5, 16), 1),
            )

        row.update(TARGETS_AFTER if d >= TARGET_CHANGE else TARGETS_BEFORE)
        rows.append(row)
        d += timedelta(days=1)

    out = Path(__file__).with_name('dummy_health_data_202604-202609.csv')
    with out.open('w', newline='', encoding='utf-8-sig') as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(rows)
    print(f'{len(rows)} rows -> {out}')


if __name__ == '__main__':
    main()
