import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { IconMail, IconPhone, IconMessageCircle, IconLink, IconGlobe } from '../lib/examineeIcons';

const DEFAULT_METHODS = [
  { id: 'default-email', type: 'email', label: 'Email', value: 'dentalmcqbd@gmail.com' },
];

// Contact methods are admin-managed data (app_settings.contact_methods), so
// the icon shown here is derived from the method's fixed `type`, not the
// raw stored value — keeps the student-facing icon set consistent no
// matter what the admin panel has saved.
const TYPE_ICONS = {
  email: IconMail,
  phone: IconPhone,
  whatsapp: IconMessageCircle,
  facebook: IconGlobe,
  custom: IconLink,
};

function hrefFor(method) {
  const v = (method.value || '').trim();
  if (!v) return null;
  switch (method.type) {
    case 'email':
      return `mailto:${v}`;
    case 'phone':
      return `tel:${v}`;
    case 'whatsapp':
      return `https://wa.me/${v.replace(/[^\d]/g, '')}`;
    default:
      return /^https?:\/\//i.test(v) ? v : null;
  }
}

export default function ContactUsPage() {
  const [methods, setMethods] = useState(null);

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'contact_methods').maybeSingle().then(({ data }) => {
      const list = Array.isArray(data?.value) ? data.value : DEFAULT_METHODS;
      setMethods(list.filter((m) => (m.value || '').trim()));
    });
  }, []);

  return (
    <div className="panel">
      <h2>Contact Us</h2>
      <p className="muted small">Questions, feedback, or anything else — reach us here.</p>

      {methods === null && <p className="muted small">Loading…</p>}

      <div className="contact-card-list">
        {methods?.map((m) => {
          const href = hrefFor(m);
          const Tag = href ? 'a' : 'div';
          return (
            <Tag
              key={m.id}
              className="contact-card"
              href={href || undefined}
              target={m.type === 'whatsapp' || (href && href.startsWith('http')) ? '_blank' : undefined}
              rel={m.type === 'whatsapp' || (href && href.startsWith('http')) ? 'noopener noreferrer' : undefined}
            >
              <span className="contact-card-icon">
                {(() => {
                  const TypeIcon = TYPE_ICONS[m.type] || IconLink;
                  return <TypeIcon size={24} />;
                })()}
              </span>
              <span>
                <span className="contact-card-label">{m.label}</span>
                <span className="contact-card-value">{m.value}</span>
              </span>
            </Tag>
          );
        })}
      </div>

      {methods && methods.length === 0 && <p className="muted small">No contact info has been added yet.</p>}

      <p className="muted small" style={{ marginTop: 14 }}>
        For account-specific issues (password, payment, subscription), you can also message the
        admin team directly from the Messages tab — that's usually the fastest way to get help.
      </p>
    </div>
  );
}
