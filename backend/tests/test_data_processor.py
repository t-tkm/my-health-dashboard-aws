"""compute() の単体テスト（DynamoDB には接続しない）。

実行方法:
    pip install -r backend/requirements.txt pytest
    pytest backend/tests
"""
import io
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import data_processor  # noqa: E402
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


class _FakeTable:
    """import_csv_to_dynamo() が使う query / batch_writer だけを持つ DynamoDB テーブルの代役。"""

    def __init__(self, dates):
        self.items = {d: {'userId': 'u', 'date': d} for d in dates}

    def query(self, **kwargs):
        return {'Items': [{'date': d} for d in sorted(self.items)]}

    def batch_writer(self):
        table = self

        class _Batch:
            def __enter__(self):
                return self

            def __exit__(self, *exc):
                return False

            def put_item(self, Item):
                table.items[Item['date']] = Item

            def delete_item(self, Key):
                table.items.pop(Key['date'], None)

        return _Batch()


def _csv(*dates):
    rows = '\n'.join(f'{d},70.0' for d in dates)
    return io.BytesIO(f'date,weight\n{rows}\n'.encode('utf-8'))


def test_import_replaces_existing_data(monkeypatch):
    # CSV をマスターとして扱う: CSV にない日付は消え、CSV の日付だけが残る
    table = _FakeTable(['2026-03-31', '2026-04-01', '2026-09-30'])
    monkeypatch.setattr(data_processor, '_get_table', lambda: table)
    result = data_processor.import_csv_to_dynamo('u', _csv('2026/4/1', '2026/4/2'))
    assert result == {'imported': 2, 'deleted': 2}
    assert sorted(table.items) == ['2026-04-01', '2026-04-02']


def test_import_rejects_empty_csv_without_deleting(monkeypatch):
    table = _FakeTable(['2026-04-01'])
    monkeypatch.setattr(data_processor, '_get_table', lambda: table)
    with pytest.raises(ValueError):
        data_processor.import_csv_to_dynamo('u', io.BytesIO(b'date,weight\n'))
    assert sorted(table.items) == ['2026-04-01']


def test_import_rejects_duplicate_dates(monkeypatch):
    table = _FakeTable(['2026-04-01'])
    monkeypatch.setattr(data_processor, '_get_table', lambda: table)
    with pytest.raises(ValueError):
        data_processor.import_csv_to_dynamo('u', _csv('2026/4/2', '2026/4/2'))
    assert sorted(table.items) == ['2026-04-01']
