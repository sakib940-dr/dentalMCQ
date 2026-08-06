import { useState } from 'react';

export function passwordChecks(pw) {
  return {
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    number: /[0-9]/.test(pw),
  };
}

export function isStrongPassword(pw) {
  const c = passwordChecks(pw);
  return c.length && c.upper && c.lower && c.number;
}

// A password <input> with a show/hide eye toggle and a live strength
// checklist underneath. Controlled component — pass value/onChange like
// a normal input. Set showChecklist={false} to hide the hints (e.g. on
// a login page where you don't want to coach the requirements again).
export default function PasswordField({ value, onChange, label = 'Password', placeholder, showChecklist = true, required = true }) {
  const [visible, setVisible] = useState(false);
  const checks = passwordChecks(value || '');
  const touched = (value || '').length > 0;

  return (
    <label>
      <span>{label}</span>
      <div className="password-field-wrap">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
        />
        <button
          type="button"
          className="password-field-eye"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? '🙈' : '👁️'}
        </button>
      </div>
      {showChecklist && touched && (
        <div className="password-checklist">
          <span className={checks.length ? 'pw-check-ok' : 'pw-check-pending'}>{checks.length ? '✓' : '○'} কমপক্ষে ৮ অক্ষর</span>
          <span className={checks.upper ? 'pw-check-ok' : 'pw-check-pending'}>{checks.upper ? '✓' : '○'} বড় হাতের অক্ষর (A-Z)</span>
          <span className={checks.lower ? 'pw-check-ok' : 'pw-check-pending'}>{checks.lower ? '✓' : '○'} ছোট হাতের অক্ষর (a-z)</span>
          <span className={checks.number ? 'pw-check-ok' : 'pw-check-pending'}>{checks.number ? '✓' : '○'} একটি সংখ্যা (0-9)</span>
        </div>
      )}
    </label>
  );
}
