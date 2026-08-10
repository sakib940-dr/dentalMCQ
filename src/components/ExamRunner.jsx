import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { getExamFontSize } from '../lib/examFontSize';
import { IconHeart, IconStar, IconCheck } from '../lib/examineeIcons';

function fmtTime(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return h > 0 ? `${h}:${m}:${sec}` : `${m}:${sec}`;
}

// Memoized so answering ONE question doesn't re-render every other card in
// the list. Only re-renders when THIS question's own selected/marked/
// bookmarked state changes — not on every keystroke/click anywhere in the
// exam. This only works because the callback props below are stable
// (wrapped in useCallback with empty deps in ExamRunner, and in the
// callers that pass onToggleBookmark down) — passing a freshly-created
// function every render would silently defeat the memoization.
const RunnerQuestionCard = memo(function RunnerQuestionCard({
  question, index, selectedLetter, isMarked, isBookmarked, onSelect, onToggleMark, onToggleBookmark,
}) {
  return (
    <div id={`runner-q-${question.id}`} data-qindex={index} className="panel exam-run-qcard">
      <div className="q-num-row">
        <span className="q-num-label">Question {index + 1}</span>
        <div className="q-num-row-actions">
          {onToggleBookmark && (
            <button
              className={isBookmarked ? 'bookmark-inline-btn bookmark-inline-btn-active' : 'bookmark-inline-btn'}
              onClick={() => onToggleBookmark(question.id)}
              aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this question'}
            >
              {isBookmarked ? <IconHeart size={16} fill="currentColor" /> : <IconHeart size={16} />}
            </button>
          )}
          <button
            className={isMarked ? 'mark-inline-btn mark-inline-btn-active' : 'mark-inline-btn'}
            onClick={() => onToggleMark(question.id)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <IconStar size={13} fill={isMarked ? 'currentColor' : 'none'} /> {isMarked ? 'Marked' : 'Mark'}
          </button>
        </div>
      </div>
      <div className="q-text">{question.question_text}</div>
      <div className="opt-list">
        {['A', 'B', 'C', 'D'].map((letter) => {
          const selected = selectedLetter === letter;
          return (
            <button
              key={letter}
              className={selected ? 'opt-btn opt-selected' : 'opt-btn'}
              onClick={() => onSelect(question.id, letter)}
            >
              <span className="opt-letter">{letter}</span>
              <span className="opt-text">{question[`option_${letter.toLowerCase()}`]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
});

function requestFullscreen(el) {
  const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
  if (req) return req.call(el).catch(() => {});
  return Promise.resolve();
}
function exitFullscreen() {
  const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
  if (document.fullscreenElement && exit) return exit.call(document).catch(() => {});
  return Promise.resolve();
}

/**
 * Generic runner for both Practice and Live Exam.
 * Mobile-first: immersive fullscreen, sticky timer header, sticky bottom nav
 * (Prev / Next / Mark for review / Submit), resume-after-refresh via localStorage
 * with wall-clock-accurate timer, one question focused at a time with jump nav.
 *
 * Props (unchanged from before so callers don't need to change):
 *  - questions: [{ id, question_text, option_a..d, correct_option, explanation }]
 *  - durationMinutes: number (locked once started)
 *  - negativeMarking: number (marks deducted per wrong answer)
 *  - title: string shown in the sticky header
 *  - onSubmit(answersMap, meta) -> called once
 *  - onExit() -> called if user exits before starting or cancels
 *  - allowTimeAdjust: boolean - show the pre-start timer customization screen
 *  - persistKey: string|null - localStorage key for auto-save/resume (per attempt)
 *  - bookmarkedIds: Set|undefined - question ids already bookmarked by this student.
 *    Optional — if omitted, no bookmark button is shown, so existing callers
 *    that don't pass it keep working unchanged.
 *  - onToggleBookmark(questionId): optional callback, called when the
 *    bookmark button is tapped. ExamRunner stays presentational — it never
 *    talks to Supabase itself; the caller owns persistence.
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
  bookmarkedIds,
  onToggleBookmark,
}) {
  const [phase, setPhase] = useState('setup'); // setup | fullscreen-gate | running | submitted
  const [customMinutes, setCustomMinutes] = useState(durationMinutes);
  const [answers, setAnswers] = useState({});
  const [marked, setMarked] = useState({}); // { questionId: true }
  const [result, setResult] = useState(null);
  const [now, setNow] = useState(Date.now());
  // Read once — Settings changes apply the next time an exam/practice
  // session is opened, not live mid-exam (there's no need for that).
  const [fontSize] = useState(getExamFontSize);
  const fontSizeClass = `exam-font-${fontSize}`;

  const endAtRef = useRef(null); // absolute ms timestamp when exam should auto-submit
  const shellRef = useRef(null);
  const scrollListRef = useRef(null);
  const submittedRef = useRef(false);
  const resumedRef = useRef(false);

  // ---------- Resume from localStorage (wall-clock accurate) ----------
  useEffect(() => {
    if (!persistKey || resumedRef.current) return;
    resumedRef.current = true;
    try {
      const saved = JSON.parse(localStorage.getItem(persistKey) || 'null');
      if (saved && saved.phase === 'running' && saved.endAt) {
        if (saved.endAt > Date.now()) {
          setAnswers(saved.answers || {});
          setMarked(saved.marked || {});
          setCustomMinutes(saved.customMinutes ?? durationMinutes);
          endAtRef.current = saved.endAt;
          setPhase('running');
        } else {
          // Time already ran out while away — clear and let it auto-submit fresh
          localStorage.removeItem(persistKey);
        }
      }
    } catch {
      // ignore corrupt saved state
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Persist progress ----------
  useEffect(() => {
    if (!persistKey || phase !== 'running') return;
    localStorage.setItem(persistKey, JSON.stringify({
      phase, answers, marked, customMinutes, endAt: endAtRef.current,
    }));
  }, [persistKey, phase, answers, marked, customMinutes]);

  // ---------- Submit ----------
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
    exitFullscreen();

    // The student sees their result immediately above, but the actual
    // database write is staggered by a small random delay. This spreads
    // out submission load when many students' timers expire at the same
    // moment (a live exam where everyone started together), instead of
    // hundreds of write requests landing on the database in the same
    // instant. Manual submits (button click) get no delay — only
    // auto-submits from the timer running out benefit from this, since
    // that's the scenario that actually clusters in time.
    const isAutoSubmit = endAtRef.current && Date.now() >= endAtRef.current;
    if (isAutoSubmit) {
      const jitterMs = Math.floor(Math.random() * 4000);
      await new Promise((resolve) => setTimeout(resolve, jitterMs));
    }

    await onSubmit?.(answers, r);
  }, [answers, negativeMarking, onSubmit, persistKey, questions]);

  // ---------- Timer tick (wall-clock based, survives refresh/reconnect) ----------
  useEffect(() => {
    if (phase !== 'running') return;
    const tick = () => {
      setNow(Date.now());
      if (endAtRef.current && Date.now() >= endAtRef.current) {
        doSubmit();
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [phase, doSubmit]);

  const secondsLeft = endAtRef.current ? Math.max(0, Math.round((endAtRef.current - now) / 1000)) : customMinutes * 60;

  // Warn before accidental tab close/reload while an exam is running
  useEffect(() => {
    if (phase !== 'running') return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [phase]);

  // Intercept the browser/phone Back button while running so it doesn't
  // silently exit an in-progress exam. We push a guard history entry and
  // re-push it whenever back is pressed, showing a confirm dialog instead.
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  useEffect(() => {
    if (phase !== 'running') return;
    window.history.pushState({ examGuard: true }, '');
    const handler = () => {
      window.history.pushState({ examGuard: true }, '');
      setShowExitConfirm(true);
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [phase]);

  const beginRunning = () => {
    endAtRef.current = Date.now() + customMinutes * 60 * 1000;
    setPhase('running');
  };

  const start = async () => {
    // Try fullscreen; whether it succeeds or not, we proceed into the exam.
    if (shellRef.current) {
      await requestFullscreen(shellRef.current);
    }
    beginRunning();
  };

  const selectAnswer = useCallback((questionId, letter) => {
    setAnswers((a) => ({ ...a, [questionId]: a[questionId] === letter ? undefined : letter }));
  }, []);

  const toggleMark = useCallback((questionId) => {
    setMarked((m) => ({ ...m, [questionId]: !m[questionId] }));
  }, []);

  const answeredCount = Object.values(answers).filter(Boolean).length;

  // ============================================================
  // SETUP SCREEN
  // ============================================================
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
        <div className="muted small" style={{ marginTop: 10 }}>
          The exam will open in full-screen mode for a distraction-free experience.
        </div>
        <div className="exam-setup-actions">
          <button className="btn-secondary" onClick={onExit}>Cancel</button>
          <button className="btn-primary" onClick={start}>Start</button>
        </div>
      </div>
    );
  }

  // ============================================================
  // SUBMITTED SCREEN — full answer sheet
  // ============================================================
  if (phase === 'submitted') {
    const pct = result.percentage;
    return (
      <div className={`answer-sheet-page ${fontSizeClass}`}>
        <div className="panel answer-sheet-summary">
          <h2>Result</h2>
          <div className="result-stat-row">
            <div className="result-stat">
              <span className="result-stat-value result-stat-correct">{result.correct}</span>
              <span className="result-stat-label">Correct</span>
            </div>
            <div className="result-stat">
              <span className="result-stat-value result-stat-wrong">{result.wrong}</span>
              <span className="result-stat-label">Wrong</span>
            </div>
            <div className="result-stat">
              <span className="result-stat-value result-stat-unanswered">{result.unanswered}</span>
              <span className="result-stat-label">Unanswered</span>
            </div>
          </div>
          <div className="result-big-row">
            <div className="result-big-pct">{pct}%</div>
            {negativeMarking > 0 && (
              <div className="result-big-mark">{result.score.toFixed(2)} / {result.total} marks</div>
            )}
          </div>
        </div>

        <div className="answer-sheet-list">
          {questions.map((q, i) => {
            const chosen = answers[q.id];
            const isCorrect = chosen === q.correct_option;
            let cardClass = 'panel answer-sheet-card';
            if (!chosen) cardClass += ' answer-sheet-unanswered';
            else if (isCorrect) cardClass += ' answer-sheet-correct';
            else cardClass += ' answer-sheet-wrong';

            return (
              <div key={q.id} className={cardClass}>
                <div className="q-num-row">
                  <span className="q-num-label">Question {i + 1}</span>
                  <div className="q-num-row-actions">
                    {!chosen && <span className="sheet-tag sheet-tag-unanswered">Unanswered</span>}
                    {chosen && isCorrect && <span className="sheet-tag sheet-tag-correct">Correct</span>}
                    {chosen && !isCorrect && <span className="sheet-tag sheet-tag-wrong">Wrong</span>}
                    {onToggleBookmark && (
                      <button
                        className={bookmarkedIds?.has(q.id) ? 'bookmark-inline-btn bookmark-inline-btn-active' : 'bookmark-inline-btn'}
                        onClick={() => onToggleBookmark(q.id)}
                        aria-label={bookmarkedIds?.has(q.id) ? 'Remove bookmark' : 'Bookmark this question'}
                      >
                        {bookmarkedIds?.has(q.id) ? <IconHeart size={16} fill="currentColor" /> : <IconHeart size={16} />}
                      </button>
                    )}
                  </div>
                </div>
                <div className="q-text">{q.question_text}</div>
                <div className="opt-list">
                  {['A', 'B', 'C', 'D'].map((letter) => {
                    const isCorrectOpt = letter === q.correct_option;
                    const isChosenWrong = letter === chosen && !isCorrect;
                    let cls = 'opt-btn opt-static';
                    if (isCorrectOpt) cls += ' opt-correct';
                    else if (isChosenWrong) cls += ' opt-wrong';
                    return (
                      <div key={letter} className={cls}>
                        <span className="opt-letter">{letter}</span>
                        <span className="opt-text">{q[`option_${letter.toLowerCase()}`]}</span>
                        {isCorrectOpt && <span className="opt-tag-correct" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconCheck size={13} /> correct</span>}
                        {isChosenWrong && <span className="opt-tag-wrong">your answer</span>}
                      </div>
                    );
                  })}
                </div>
                {q.explanation && <div className="expl-box"><b>Why:</b> {q.explanation}</div>}
              </div>
            );
          })}
        </div>

        <div className="answer-sheet-done">
          <button className="btn-primary" onClick={onExit}>Done</button>
        </div>
      </div>
    );
  }

  // ============================================================
  // RUNNING — immersive mobile exam screen (smooth scroll, all questions)
  // ============================================================
  const urgent = secondsLeft <= 30;

  return (
    <div className={`exam-run-shell exam-run-immersive ${fontSizeClass}`} ref={shellRef}>
      <div className="exam-run-header">
        <div className="exam-run-header-left">
          <div className="exam-run-header-title">{title}</div>
          <div className="exam-run-qcounter">{answeredCount}/{questions.length} answered</div>
        </div>
        <div className={urgent ? 'exam-run-timer exam-run-timer-urgent' : 'exam-run-timer'}>
          <span className="timer-clock-icon">⏱</span>{fmtTime(secondsLeft)}
        </div>
      </div>

      <div className="exam-run-scrolllist" ref={scrollListRef}>
        {questions.map((q, i) => (
          <RunnerQuestionCard
            key={q.id}
            question={q}
            index={i}
            selectedLetter={answers[q.id]}
            isMarked={!!marked[q.id]}
            isBookmarked={!!bookmarkedIds?.has(q.id)}
            onSelect={selectAnswer}
            onToggleMark={toggleMark}
            onToggleBookmark={onToggleBookmark}
          />
        ))}
        <div className="exam-run-scroll-end" />
      </div>

      <div className="exam-run-bottombar exam-run-bottombar-single">
        <span className="bottombar-answered-count">{answeredCount} of {questions.length} answered</span>
        <button className="bottombar-submit-full" onClick={doSubmit}>Submit exam</button>
      </div>

      {showExitConfirm && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-title">Leave the exam?</div>
            <div className="modal-body">
              Your exam is still in progress. Going back won't submit it — you can keep answering,
              or submit now if you're done.
            </div>
            <div className="modal-actions">
              <button className="modal-cancel-btn" onClick={() => setShowExitConfirm(false)}>Continue exam</button>
              <button className="modal-confirm-btn" onClick={() => { setShowExitConfirm(false); doSubmit(); }}>Submit now</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
