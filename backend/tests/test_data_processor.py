"""compute() の単体テスト（DynamoDB には接続しない）。

実行方法:
    pip install -r backend/requirements.txt pytest
    pytest backend/tests
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from data_processor import compute  # noqa: E402


def _item(day: int, **fields) -> dict:
    return {'userId': 'u', 'date': f'2026-05-{day:02d}', **fields}


def test_empty_items_returns_no_data():
    assert compute([]) == {'error': 'no_data'}


def test_avg_cal_ignores_days_without_meal_records():
    # 体重だけ記録した日（calories なし）が 0kcal として平均に入らないこと
    items = [_item(1, weight=70.0, calories=2000.0),
             _item(2, weight=69.8),
             _item(3, weight=69.6, calories=1800.0),
             _item(4, weight=69.5)]
    assert compute(items)['avg_cal'] == 1900


def test_avg_cal_is_zero_when_no_meal_recorded():
    items = [_item(1, weight=70.0), _item(2, weight=69.8)]
    assert compute(items)['avg_cal'] == 0


def test_cleared_weight_is_not_interpolated_for_display():
    # 体重をクリアした日はグラフ上で補間値が表示されないこと（null のまま返す）
    items = [_item(1, weight=70.0), _item(2, calories=2000.0), _item(3, weight=69.0)]
    result = compute(items)
    assert result['weights'] == [70.0, None, 69.0]
    assert result['current_weight'] == 69.0


def test_body_fat_sma_is_not_contaminated_by_missing_days():
    items = [_item(1, weight=70.0, body_fat_percent=20.0),
             _item(2, weight=69.9),
             _item(3, weight=69.8, body_fat_percent=22.0)]
    result = compute(items)
    assert result['body_fat_percents'] == [20.0, None, 22.0]
    assert result['sma7_body_fat'][-1] == 21.0


def test_slope_is_none_until_enough_days():
    # 記録開始から 14 日分そろうまでは傾きを出さない（数日分の回帰で大きく振れるのを防ぐ）
    items = [_item(d, weight=70.0 - 0.1 * d) for d in range(1, 21)]
    result = compute(items)
    assert result['slope_dates'][:2] == ['2026-05-07', '2026-05-14']
    assert result['slope_values'][0] is None
    assert result['slope_values'][1] == -0.1
