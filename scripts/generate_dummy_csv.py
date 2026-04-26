#!/usr/bin/env python3
"""1年分のダミーデータを CSV ファイルに出力する。

Web UI の「CSVをインポートする」でそのまま使える形式で生成する。

Usage:
    python scripts/generate_dummy_csv.py
    python scripts/generate_dummy_csv.py --days 90 --out my_data.csv
"""
import argparse
import csv
import math
import random
from datetime import date, timedelta

random.seed(42)


def main() -> None:
    parser = argparse.ArgumentParser(description='ダミー健康データ CSV を生成する')
    parser.add_argument('--days', type=int, default=365, help='生成する日数（デフォルト: 365）')
    parser.add_argument('--out',  default='dummy_health_data.csv', help='出力ファイル名')
    parser.add_argument('--weight-start', type=float, default=80.0)
    parser.add_argument('--weight-end',   type=float, default=73.5)
    parser.add_argument('--bf-start',     type=float, default=22.0, help='体脂肪率 開始値 (%)')
    parser.add_argument('--bf-end',       type=float, default=17.5, help='体脂肪率 終了値 (%)')
    args = parser.parse_args()

    today = date.today()
    start = today - timedelta(days=args.days - 1)

    raw_weights = []
    raw_bf      = []
    for i in range(args.days):
        progress = i / max(args.days - 1, 1)
        # 体重
        trend  = args.weight_start + (args.weight_end - args.weight_start) * (1 - math.exp(-3 * progress))
        weekday = (start + timedelta(days=i)).weekday()
        weekly = 0.25 * math.sin(2 * math.pi * weekday / 7)
        raw_weights.append(trend + weekly + random.gauss(0, 0.25))
        # 体脂肪率
        bf_trend = args.bf_start + (args.bf_end - args.bf_start) * (1 - math.exp(-3 * progress))
        raw_bf.append(bf_trend + random.gauss(0, 0.4))

    weights = []
    for i in range(args.days):
        s = max(0, i - 1)
        e = min(args.days, i + 2)
        weights.append(round(sum(raw_weights[s:e]) / (e - s), 1))

    body_fats = []
    for i in range(args.days):
        s = max(0, i - 1)
        e = min(args.days, i + 2)
        body_fats.append(round(sum(raw_bf[s:e]) / (e - s), 1))

    rows = []
    for i in range(args.days):
        d = start + timedelta(days=i)
        weekday = d.weekday()
        cal_base = 1750 + (200 if weekday >= 5 else 0)
        cal = max(800, round(random.gauss(cal_base, 200)))
        scale = cal / 1750
        rows.append({
            '日付':          d.strftime('%Y/%m/%d'),
            '体重':          weights[i],
            '体脂肪率':      body_fats[i],
            'カロリー':       cal,
            'たんぱく質':     round(max(40,  random.gauss(95 * scale, 15)), 1),
            '脂質':           round(max(20,  random.gauss(85 * scale, 12)), 1),
            '炭水化物':       round(max(50,  random.gauss(172 * scale, 30)), 1),
            '糖質':           round(max(30,  random.gauss(138 * scale, 25)), 1),
            '食物繊維':       round(max(5,   random.gauss(21, 4)), 1),
            '塩分':           round(max(1,   random.gauss(7.5 * scale, 2)), 1),
            'カロリー(目安)':     1750,
            'たんぱく質(目安)':   95,
            '脂質(目安)':         85,
            '炭水化物(目安)':     172,
            '糖質(目安)':         138,
            '食物繊維(目安)':     21,
            '塩分(目安)':         7.5,
        })

    with open(args.out, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    print(f'{len(rows)} 件のダミーデータを {args.out} に出力しました。')
    print(f'期間:     {rows[0]["日付"]} 〜 {rows[-1]["日付"]}')
    print(f'体重:     {rows[0]["体重"]} → {rows[-1]["体重"]} kg')
    print(f'体脂肪率: {rows[0]["体脂肪率"]} → {rows[-1]["体脂肪率"]} %')


if __name__ == '__main__':
    main()
