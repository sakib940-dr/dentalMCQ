import { useNavigate } from 'react-router-dom';

export default function SupportHubPage() {
  const navigate = useNavigate();

  const items = [
    { icon: '❓', label: 'Help Center', sub: 'Step-by-step guides in Bengali', onClick: () => window.open('/help', '_blank') },
    { icon: '📝', label: 'Feedback', sub: 'Report a bug or suggest a feature', onClick: () => navigate('/dashboard/feedback') },
    { icon: '📞', label: 'Contact Us', sub: 'Email and Facebook', onClick: () => navigate('/dashboard/contact') },
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
