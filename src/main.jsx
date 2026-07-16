import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.jsx'

// Error tracking — completely inert until VITE_SENTRY_DSN is set in Vercel's
// environment variables, so this is safe to ship before you've even created
// a Sentry account. Once the DSN is set, every uncaught frontend error (a
// crash during a live exam, a failed submission, etc.) gets reported with
// enough context to actually debug it after the fact, instead of a student
// just seeing a blank screen and nobody ever finding out.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    // Session Replay + tracing are paid-tier features on some plans and
    // add bundle weight — sampled low/off by default. Raise these once
    // you've confirmed the free tier's error volume is comfortable.
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)

function ErrorFallback() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', fontFamily: 'sans-serif' }}>
      <div>
        <h2>Something went wrong</h2>
        <p>Please refresh the page. If you were in the middle of an exam, your answers up to this point were already auto-saved.</p>
        <button onClick={() => window.location.reload()} style={{ marginTop: 12, padding: '10px 20px', cursor: 'pointer' }}>
          Refresh
        </button>
      </div>
    </div>
  );
}
