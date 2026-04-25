#!/usr/bin/env python3
"""1年分のダミーデータを生成して data.csv に保存する。

Usage:
    uv run python generate_dummy.py
"""
import math
import random
from datetime import date, timedelta

import numpy as np
import pandas as pd

from data_processor import DATA_CSV_PATH, save_csv, compute

random.seed(42)
np.random.seed(42)

N_DAYS = 365
TODAY = date.today()
START = TODAY - timedelta(days=N_DAYS - 1)
DATES = [(START + timedelta(days=i)).strftime('%Y-%m-%d') for i in range(N_DAYS)]

# ── 体重 ──────────────────────────────────────────────────────────────────────
WEIGHT_START = 80.0
WEIGHT_END   = 73.5

raw_weights = []
for i in range(N_DAYS):
    progress = i / (N_DAYS - 1)
    trend   = WEIGHT_START + (WEIGHT_END - WEIGHT_START) * (1 - math.exp(-3 * progress))
    weekday = (START + timedelta(days=i)).weekday()
    weekly  = 0.25 * math.sin(2 * math.pi * weekday / 7)
    noise   = random.gauss(0, 0.25)
    raw_weights.append(trend + weekly + noise)

weights = []
for i in range(N_DAYS):
    s = max(0, i - 1)
    e = min(N_DAYS, i + 2)
    weights.append(round(sum(raw_weights[s:e]) / (e - s), 1))

# ── 食事 ──────────────────────────────────────────────────────────────────────
TARGETS = {
    'カロリー(目安)':    1750,
    'たんぱく質(目安)':  95,
    '脂質(目安)':        85,
    '炭水化物(目安)':    172,
    '糖質(目安)':        138,
    '食物繊維(目安)':    21,
    '塩分(目安)':        7.5,
}

rows = []
for i, d in enumerate(DATES):
    weekday = (START + timedelta(days=i)).weekday()
    cal_base = 1750 + (200 if weekday >= 5 else 0)
    cal = max(800, round(random.gauss(cal_base, 200)))
    scale   = cal / 1750
    protein = round(max(40,  random.gauss(95 * scale, 15)), 1)
    fat     = round(max(20,  random.gauss(85 * scale, 12)), 1)
    carb    = round(max(50,  random.gauss(172 * scale, 30)), 1)
    sugar   = round(max(30,  min(carb, random.gauss(138 * scale, 25))), 1)
    fiber   = round(max(5,   random.gauss(21, 4)), 1)
    salt    = round(max(1,   random.gauss(7.5 * scale, 2)), 1)
    rows.append({
        '日付':      d,
        '体重':      weights[i],
        'カロリー':  float(cal),
        'たんぱく質': protein,
        '脂質':      fat,
        '炭水化物':  carb,
        '糖質':      sugar,
        '食物繊維':  fiber,
        '塩分':      salt,
        **TARGETS,
    })

df = pd.DataFrame(rows)
save_csv(df, DATA_CSV_PATH)

result = compute(df)
print(f'Generated {N_DAYS} days of dummy data → {DATA_CSV_PATH}')
print(f'  Weight  : {weights[0]} → {weights[-1]} kg')
cals = result['calories']
print(f'  Calories: {int(sum(cals)/len(cals))} kcal avg')
