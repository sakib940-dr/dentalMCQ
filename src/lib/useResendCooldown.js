import { useState, useEffect, useRef } from 'react';

// Supabase returns a message like "For security purposes, you can only
// request this after 43 seconds." when its own rate limit is hit — parse
// the real wait time out of it when present, so the cooldown shown
// matches reality instead of guessing.
export function parseRateLimitSeconds(message) {
  const match = /after (\d+) seconds?/i.exec(message || '');
  return match ? parseInt(match[1], 10) : null;
}

export function useResendCooldown(defaultSeconds = 60) {
  const [remaining, setRemaining] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => () => clearInterval(timerRef.current), []);

  const start = (customSeconds) => {
    const total = customSeconds || defaultSeconds;
    setRemaining(total);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { clearInterval(timerRef.current); return 0; }
        return r - 1;
      });
    }, 1000);
  };

  return { remaining, start, active: remaining > 0 };
}
