import { RangeDays } from '../utils/filterData';

const OPTIONS: { label: string; value: RangeDays }[] = [
  { label: '30日',  value: 30  },
  { label: '90日',  value: 90  },
  { label: '半年',  value: 180 },
  { label: '1年',   value: 365 },
  { label: '全期間', value: null },
];

interface Props {
  value: RangeDays;
  totalDays: number;
  onChange: (v: RangeDays) => void;
}

export default function RangeFilter({ value, totalDays, onChange }: Props) {
  return (
    <div className="range-filter">
      {OPTIONS.map(opt => {
        const disabled = opt.value !== null && opt.value > totalDays;
        const active   = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            className={`range-btn${active ? ' active' : ''}`}
            onClick={() => onChange(opt.value)}
            disabled={disabled}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
