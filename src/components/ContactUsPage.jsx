import { useAppSetting } from './FeatureLock';

export default function ContactUsPage() {
  const { value: email } = useAppSetting('contact_email', 'dentalmcqbd@gmail.com');
  const { value: facebook } = useAppSetting('contact_facebook', '');

  return (
    <div className="panel">
      <h2>Contact Us</h2>
      <p className="muted small">Questions, feedback, or anything else — reach us here.</p>

      <div className="contact-card-list">
        <a className="contact-card" href={`mailto:${email}`}>
          <span className="contact-card-icon">✉️</span>
          <span>
            <span className="contact-card-label">Email</span>
            <span className="contact-card-value">{email}</span>
          </span>
        </a>

        {facebook && (
          <a className="contact-card" href={facebook} target="_blank" rel="noopener noreferrer">
            <span className="contact-card-icon">📘</span>
            <span>
              <span className="contact-card-label">Facebook</span>
              <span className="contact-card-value">{facebook}</span>
            </span>
          </a>
        )}
      </div>

      <p className="muted small" style={{ marginTop: 14 }}>
        For account-specific issues (password, payment, subscription), you can also message the
        admin team directly from the Messages tab — that's usually the fastest way to get help.
      </p>
    </div>
  );
}
