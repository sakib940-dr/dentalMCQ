import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useAppSetting(key, defaultValue = true) {
  const [value, setValue] = useState(defaultValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase.from('app_settings').select('value').eq('key', key).maybeSingle().then(({ data }) => {
      if (cancelled) return;
      setValue(data ? data.value : defaultValue);
      setLoading(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { value, loading };
}

export function LockedFeature() {
  return (
    <div className="panel locked-feature">
      <div className="locked-feature-icon">🔒</div>
      <h2>This feature is locked</h2>
      <p className="muted">
        This feature is locked because your subscription is not active.
        <br /><br />
        Please contact the administrator to complete payment and activate your access.
      </p>
    </div>
  );
}
