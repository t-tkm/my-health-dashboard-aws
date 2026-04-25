import { useEffect, useState } from 'react';
import { HealthData } from '../types';

interface State {
  data: HealthData | null;
  loading: boolean;
  error: string | null;
  isEmpty: boolean;
}

interface StateWithRefresh extends State {
  refresh: () => void;
}

export function useHealthData(): StateWithRefresh {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<State>({ data: null, loading: true, error: null, isEmpty: false });

  useEffect(() => {
    setState(s => ({ ...s, loading: true }));
    fetch('/api/data', { credentials: 'same-origin' })
      .then(res => {
        if (res.status === 404) {
          setState({ data: null, loading: false, error: null, isEmpty: true });
          return null;
        }
        if (!res.ok) throw new Error(`エラーが発生しました (HTTP ${res.status})`);
        return res.json() as Promise<HealthData>;
      })
      .then(data => {
        if (data !== null) setState({ data, loading: false, error: null, isEmpty: false });
      })
      .catch(e => setState({ data: null, loading: false, error: String(e.message), isEmpty: false }));
  }, [version]);

  return { ...state, refresh: () => setVersion(v => v + 1) };
}
