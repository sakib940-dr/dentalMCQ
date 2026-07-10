import { useState, useEffect, useRef, useCallback } from 'react';

function fmtTime(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

/**
 * Generic runner for both Practice and Live Exam.
 *
 * Props:
 *  - questions: [{ id, question_text, option_a..d, correct_option, explanation }]
 *  - durationMinutes: number (locked once started)
 *  - negativeMarking: number (marks deducted per wrong answer)
 *  - title: string shown in the sticky header
 *  - onSubmit(answersMap, meta) -> called once, with { questionId: 'A'|'B'|'C'|'D'|null }
 *  - onExit() -> called if user exits before starting or cancels
 *  - allowTimeAdjust: boolean - show the pre-start timer customization screen
 *  - resultRenderer(result) -> optional custom result screen; if omitted, a default is shown
 *  - persistKey: string - localStorage key prefix for auto-save/resume (per attempt)
 */
export default function ExamRunner({
  questions,
  durationMinutes,
  negativeMarking = 0,
  title,
  onSubmit,
  onExit,
  allowTimeAdjust = true,
  persistKey,
}) {
  const [phase, setPhase] = useState('setup'); // setup | running | submitted
  const [customMinutes, setCustomMinutes] = useState(durationMinutes);
  const [answers, setAnswers] = useState({});
  const [secondsLeft, setSecondsLeft] = useState(durationMinutes * 60);
  const [filter, setFilter] = useState('all'); // all | answered | unanswered
  const [result, setResult] = useState(null);
  const startedAtRef = useRef(null);
  const submittedRef = useRef(false);

  // Resume from localStorage if a persistKey is given and there's saved progress
  useEffect(() => {
    if (!persistKey) return;
    try {
      const saved = JSON.parse(localStorage.getItem(persistKey) || 'null');
      if (saved && saved.phase === 'running') {
        setAnswers(saved.answers || {});
        setSecondsLeft(saved.secondsLeft ?? durationMinutes * 60);
        setCustomMinutes(saved.customMinutes ?? durationMinutes);
        setPhase('running');
        startedAtRef.current = saved.startedAt || Date.now();
      }
    } catch {
      // ignore corrupt saved state
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist progress on every relevant change
  useEffect(() => {
    if (!persistKey || phase !== 'running') return;
    localStorage.setItem(persistKey, JSON.stringify({
      phase, answers, secondsLeft, customMinutes, startedAt: startedAtRef.current,
    }));
  }, [persistKey, phase, answers, secondsLeft, customMinutes]);

  const doSubmit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;

    let correct = 0, wrong = 0, unanswered = 0;
    questions.forEach((q) => {
      const chosen = answers[q.id];
      if (!chosen) unanswered++;
      else if (chosen === q.correct_option) correct++;
      else wrong++;
    });
    const score = correct - wrong * negativeMarking;
    const total = questions.length;
    const percentage = total > 0 ? Math.round((correct / total) * 1000) / 10 : 0;

    const r = { correct, wrong, unanswered, score, total, percentage };
    setResult(r);
    setPhase('submitted');
    if (persistKey) localStorage.removeItem(persistKey);
    await onSubmit?.(answers, r);
  }, [answers, negativeMarking, onSubmit, persistKey, questions]);

  // Timer countdown
  useEffect(() => {
    if (phase !== 'running') return;
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          doSubmit();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase, doSubmit]);

  const start = () => {
    startedAtRef.current = Date.now();
    setSecondsLeft(customMinutes * 60);
    setPhase('running');
  };

  const selectAnswer = (questionId, letter) => {
    setAnswers((a) => ({ ...a, [questionId]: a[questionId] === letter ? undefined : letter }));
  };

  const answeredCount = Object.values(answers).filter(Boolean).length;

  if (phase === 'setup') {
    return (
      <div className="panel exam-setup">
        <h2>{title}</h2>
        <div className="exam-setup-meta">{questions.length} questions</div>
        {allowTimeAdjust ? (
          <label className="exam-setup-timer">
            <span>Time limit (minutes)</span>
            <input
              type="number"
              min={1}
              max={300}
              value={customMinutes}
              onChange={(e) => setCustomMinutes(Math.max(1, parseInt(e.target.value) || 1))}
            />
            <span className="muted small">Default: {durationMinutes} min. You can adjust it now — once you start, it's locked.</span>
          </label>
        ) : (
          <div className="exam-setup-timer-fixed">Time limit: {durationMinutes} minutes (fixed)</div>
        )}
        {negativeMarking > 0 && (
          <div className="muted small">Negative marking: −{negativeMarking} per wrong answer.</div>
        )}
        <div className="exam-setup-actions">
          <button className="btn-secondary" onClick={onExit}>Cancel</button>
          <button className="btn-primary" onClick={start}>Start</button>
        </div>
      </div>
    );
  }

  if (phase === 'submitted') {
    const pct = result.percentage;
    return (
      <div className="panel">
        <h2>Submitted</h2>
        <div className="practice-result-summary">
          <div className="score-circle" style={{ borderColor: pct >= 70 ? 'var(--green)' : pct >= 40 ? 'var(--gold)' : 'var(--red)' }}>
            <span>{pct}%</span>
          </div>
          <div className="muted">
            {result.correct} correct, {result.wrong} wrong, {result.unanswered} unanswered
            {negativeMarking > 0 && <> — score: {result.score.toFixed(2)} / {result.total}</>}
          </div>
        </div>
        <button className="btn-primary" onClick={onExit}>Done</button>
      </div>
    );
  }

  const urgent = secondsLeft <= 30;
  const visibleIndexes = questions
    .map((_, i) => i)
    .filter((i) => {
      if (filter === 'answered') return !!answers[questions[i].id];
      if (filter === 'unanswered') return !answers[questions[i].id];
      return true;
    });

  return (
    <div className="exam-run-shell">
      <div className="exam-run-header">
        <div className="exam-run-header-title">{title}</div>
        <div className={urgent ? 'exam-run-timer exam-run-timer-urgent' : 'exam-run-timer'}>{fmtTime(secondsLeft)}</div>
      </div>

      <div className="exam-run-filterbar">
        <button className={filter === 'all' ? 'filter-chip filter-chip-active' : 'filter-chip'} onClick={() => setFilter('all')}>
          All ({questions.length})
        </button>
        <button className={filter === 'answered' ? 'filter-chip filter-chip-active' : 'filter-chip'} onClick={() => setFilter('answered')}>
          Answered ({answeredCount})
        </button>
        <button className={filter === 'unanswered' ? 'filter-chip filter-chip-active' : 'filter-chip'} onClick={() => setFilter('unanswered')}>
          Unanswered ({questions.length - answeredCount})
        </button>
      </div>

      <div className="exam-run-jumpnav">
        {questions.map((q, i) => {
          const isAnswered = !!answers[q.id];
          const isVisible = visibleIndexes.includes(i);
          return (
            <button
              key={q.id}
              className={`jump-dot ${isAnswered ? 'jump-dot-done' : ''} ${!isVisible ? 'jump-dot-dim' : ''}`}
              onClick={() => document.getElementById(`runner-q-${q.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <div className="exam-run-scroll">
        {questions.map((q, i) => (
          <div key={q.id} id={`runner-q-${q.id}`} className="panel exam-run-qcard">
            <div className="q-num-label">Question {i + 1} of {questions.length}</div>
            <div className="q-text">{q.question_text}</div>
            <div className="opt-list">
              {['A', 'B', 'C', 'D'].map((letter) => {
                const selected = answers[q.id] === letter;
                return (
                  <button
                    key={letter}
                    className={selected ? 'opt-btn opt-selected' : 'opt-btn'}
                    onClick={() => selectAnswer(q.id, letter)}
                  >
                    <span className="opt-letter">{letter}</span>
                    <span className="opt-text">{q[`option_${letter.toLowerCase()}`]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className="exam-run-end">
          <div className="muted small">{answeredCount} of {questions.length} answered</div>
          <button className="btn-primary exam-submit-btn" onClick={doSubmit}>Submit</button>
        </div>
      </div>
    </div>
  );
}
