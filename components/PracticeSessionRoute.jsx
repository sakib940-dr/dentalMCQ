import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAppSetting, LockedFeature } from './FeatureLock';
import { PracticeSession } from './PracticePage';

export default function PracticeSessionRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { value: globalPracticeOn, loading } = useAppSetting('practice_enabled_global', true);
  const session = location.state?.session;

  if (loading) return null;

  if (!globalPracticeOn) return <LockedFeature />;

  if (profile && profile.practice_enabled === false) {
    return (
      <div className="panel">
        <h2>Practice mode</h2>
        <p className="muted">
          Practice mode has been disabled for your account by an administrator. Contact them via
          the Notice Board or your exam coordinator if you believe this is a mistake.
        </p>
      </div>
    );
  }

  // Direct navigation without router state (e.g. a page refresh) — there's
  // nothing to launch from here, send them back rather than showing a blank page.
  if (!session) {
    return (
      <div className="panel">
        <h2>Nothing to resume</h2>
        <p className="muted">Start a new practice session from the Dashboard.</p>
        <button className="btn-secondary" onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
      </div>
    );
  }

  return <PracticeSession session={session} onExit={() => navigate('/dashboard')} />;
}
