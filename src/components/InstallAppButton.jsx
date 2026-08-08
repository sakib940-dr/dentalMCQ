import { useEffect, useState } from 'react';

// Show schedule (see AuthContext.jsx for where the login count is
// tracked/reset): the suggestion first appears on the user's 2nd login,
// then reappears 1 day after that, then 3 days after that, then 7 days
// after that — and every 7 days from then on. Logging out resets the
// whole schedule, so it starts over from "wait for the 2nd login" again.
const DAY_MS = 24 * 60 * 60 * 1000;
const INTERVALS_AFTER_FIRST_SHOW_DAYS = [1, 3, 7];
const REPEAT_INTERVAL_DAYS = 7;

const LOGIN_COUNT_KEY = 'dentalmcq_install_login_count';
const SHOWN_COUNT_KEY = 'dentalmcq_install_shown_count';
const LAST_SHOWN_AT_KEY = 'dentalmcq_install_last_shown_at';
const INSTALLED_KEY = 'dentalmcq_install_completed';

function isDue(loginCount, shownCount, lastShownAt) {
  if (shownCount === 0) return loginCount >= 2;
  const days = INTERVALS_AFTER_FIRST_SHOW_DAYS[shownCount - 1] ?? REPEAT_INTERVAL_DAYS;
  return Date.now() - lastShownAt >= days * DAY_MS;
}

export default function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Once installed, remember it — don't rely only on display-mode,
    // since a user may accept the prompt but keep browsing in-tab
    // for the rest of the session.
    try {
      if (localStorage.getItem(INSTALLED_KEY) === '1') setInstalled(true);
    } catch {
      // ignore
    }

    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setInstalled(true);
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const installedHandler = () => {
      setInstalled(true);
      try {
        localStorage.setItem(INSTALLED_KEY, '1');
      } catch {
        // ignore
      }
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  // Once the browser hands us an installable prompt, check the
  // login-count/day schedule to decide whether it's due to show. If it
  // is, mark it as shown right away so the next milestone is measured
  // from this moment.
  useEffect(() => {
    if (!deferredPrompt || installed) {
      setVisible(false);
      return;
    }

    let loginCount = 0;
    let shownCount = 0;
    let lastShownAt = 0;
    try {
      loginCount = Number(localStorage.getItem(LOGIN_COUNT_KEY)) || 0;
      shownCount = Number(localStorage.getItem(SHOWN_COUNT_KEY)) || 0;
      lastShownAt = Number(localStorage.getItem(LAST_SHOWN_AT_KEY)) || 0;
    } catch {
      // ignore
    }

    if (isDue(loginCount, shownCount, lastShownAt)) {
      setVisible(true);
      try {
        localStorage.setItem(SHOWN_COUNT_KEY, String(shownCount + 1));
        localStorage.setItem(LAST_SHOWN_AT_KEY, String(Date.now()));
      } catch {
        // ignore
      }
    } else {
      setVisible(false);
    }
  }, [deferredPrompt, installed]);

  if (!visible) return null;

  const install = async () => {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstalled(true);
      try {
        localStorage.setItem(INSTALLED_KEY, '1');
      } catch {
        // ignore
      }
    }
    setDeferredPrompt(null);
  };

  const dismiss = () => {
    setVisible(false);
  };

  return (
    <div className="install-banner">
      <div className="install-banner-icon" aria-hidden="true">⬇</div>
      <div className="install-banner-body">
        <div className="install-banner-title">App-এর মতো সহজে ব্যবহার করতে Install করুন</div>
        <div className="install-banner-text">হোম স্ক্রিনে যোগ করুন — এক ট্যাপে খুলুন, দ্রুত লোড হবে, ব্রাউজার বার ছাড়াই।</div>
      </div>
      <div className="install-banner-actions">
        <button className="install-banner-btn" onClick={install}>Install</button>
        <button className="install-banner-dismiss" onClick={dismiss} aria-label="Not now">✕</button>
      </div>
    </div>
  );
}
