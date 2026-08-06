import { useEffect, useState } from 'react';

export default function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem('dentalmcq_install_dismissed') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const installedHandler = () => setInstalled(true);
    window.addEventListener('appinstalled', installedHandler);

    // Already running as an installed app? Don't show the prompt.
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  if (installed || dismissed || !deferredPrompt) return null;

  const install = async () => {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem('dentalmcq_install_dismissed', '1');
    } catch {
      // ignore
    }
  };

  return (
    <div className="install-banner">
      <span className="install-banner-text">Add DentalMCQ to your home screen for quick access</span>
      <div className="install-banner-actions">
        <button className="install-banner-btn" onClick={install}>Install</button>
        <button className="install-banner-dismiss" onClick={dismiss}>✕</button>
      </div>
    </div>
  );
}
