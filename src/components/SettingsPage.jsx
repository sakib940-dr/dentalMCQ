import { useState } from 'react';
import ChangePasswordPanel from './ChangePasswordPanel';
import { getExamFontSize, setExamFontSize } from '../lib/examFontSize';

const SIZES = [
  { key: 'small', label: 'Small', sample: 14 },
  { key: 'medium', label: 'Medium', sample: 17 },
  { key: 'large', label: 'Large', sample: 20 },
];

function FontSizePanel() {
  const [size, setSize] = useState(getExamFontSize);

  const choose = (key) => {
    setSize(key);
    setExamFontSize(key);
  };

  return (
    <div className="panel">
      <h2>Exam Question Text Size</h2>
      <p className="muted small">
        Controls how large question and option text appears during exams and practice —
        pick a smaller size to fit more on screen, or larger for easier reading.
      </p>
      <div className="font-size-option-row">
        {SIZES.map((s) => (
          <button
            key={s.key}
            className={size === s.key ? 'font-size-option font-size-option-active' : 'font-size-option'}
            onClick={() => choose(s.key)}
          >
            <span style={{ fontSize: s.sample }}>Aa</span>
            <span className="font-size-option-label">{s.label}</span>
          </button>
        ))}
      </div>
      <p className="muted small" style={{ marginTop: 10 }}>Takes effect the next time you open an exam or practice session.</p>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <>
      <FontSizePanel />
      <ChangePasswordPanel />
    </>
  );
}
