const KEY = 'dentalmcq_exam_font_size';
const VALID = ['small', 'medium', 'large'];

export function getExamFontSize() {
  try {
    const v = localStorage.getItem(KEY);
    return VALID.includes(v) ? v : 'medium';
  } catch {
    return 'medium';
  }
}

export function setExamFontSize(size) {
  try {
    if (VALID.includes(size)) localStorage.setItem(KEY, size);
  } catch {
    // localStorage unavailable (private browsing etc.) — the preference
    // just won't persist across sessions, nothing breaks.
  }
}
