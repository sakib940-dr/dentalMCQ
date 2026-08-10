import { useNavigate } from 'react-router-dom';
import { IconHelpCircle, IconMailbox, IconPhone } from '../lib/examineeIcons';

export default function SupportHubPage() {
  const navigate = useNavigate();

  const items = [
    { icon: <IconHelpCircle size={26} />, label: 'Help Center', sub: 'Step-by-step guides in Bengali', onClick: () => window.open('/help', '_blank') },
    { icon: <IconMailbox size={26} />, label: 'Feedback', sub: 'Report a bug or suggest a feature', onClick: () => navigate('/dashboard/feedback') },
    { icon: <IconPhone size={26} />, label: 'Contact Us', sub: 'Email and Facebook', onClick: () => navigate('/dashboard/contact') },
  ];

  return (
    <div className="panel">
      <h2>Help &amp; Support</h2>
      <div className="quick-action-grid" style={{ marginTop: 14 }}>
        {items.map((it) => (
          <button key={it.label} className="quick-action-tile" onClick={it.onClick}>
            <span className="quick-action-tile-icon">{it.icon}</span>
            <span className="quick-action-tile-label">{it.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
