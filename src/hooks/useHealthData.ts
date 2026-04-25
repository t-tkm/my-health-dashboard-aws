import { useEffect, useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { HealthData } from '../types';
import { apiEndpoint } from '../aws-config';

interface State {
  data: HealthData | null;
  loading: boolean;
  error: string | null;
  isEmpty: boolean;
}

interface StateWithRefresh extends State {
  refresh: () => void;
}

async function getIdToken(): Promise<string> {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  if (!token) throw new Error('認証トークンが取得できません');
  return token;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getIdToken();
  const base = apiEndpoint.endsWith('/') ? apiEndpoint.slice(0, -1) : apiEndpoint;
  return fetch(`${base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
      ...(init.headers ?? {}),
    },
  });
}

export function useHealthData(): StateWithRefresh {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<State>({ data: null, loading: true, error: null, isEmpty: false });

  useEffect(() => {
    setState(s => ({ ...s, loading: true }));
    apiFetch('/api/data')
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
