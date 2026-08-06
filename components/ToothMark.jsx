// Small topbar mark (40px scale): tooth silhouette wearing a graduation
// cap, gold checkmark on the crown. Simplified from the full brand mark
// so it stays legible at icon size — the full wordmark version (with
// book + tagline) is used on the login/landing screens instead.
export default function ToothMark({ size = 40 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="toothBgSm" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#12474A" />
          <stop offset="1" stopColor="#0A2B2C" />
        </linearGradient>
        <linearGradient id="pageShadeSm" x1="20" y1="14" x2="20" y2="31" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#EDEAE0" />
        </linearGradient>
      </defs>

      <rect width="40" height="40" rx="11" fill="url(#toothBgSm)" />

      {/* Tooth silhouette, shifted down slightly to make room for the cap */}
      <path
        d="M20 14.5c-2.3 0-3.6 1.2-4.9 1.2-1.7 0-3-1-4.4-1-1.8 0-3 1.7-3 4
           0 3 1.3 6 2.1 8.5.7 2.2 1 4.7 2.4 4.7 1.5 0 1.7-3.1 2.2-5.1.4-1.7
           1-2.7 2-2.7s1.6 1 2 2.7c.5 2 .7 5.1 2.2 5.1 1.4 0 1.7-2.5 2.4-4.7
           .8-2.5 2.1-5.5 2.1-8.5 0-2.3-1.2-4-3-4-1.4 0-2.7 1-4.4 1"
        fill="url(#pageShadeSm)"
      />

      {/* Graduation cap sitting on the crown */}
      <path d="M20 6.5l9 3.6-9 3.6-9-3.6z" fill="#C9A15A" />
      <path d="M14.5 11.6v3.3c0 1.3 2.5 2.3 5.5 2.3s5.5-1 5.5-2.3v-3.3" stroke="#C9A15A" strokeWidth="1.1" fill="none" strokeLinejoin="round" />
      <path d="M28.2 10.6v3.9" stroke="#C9A15A" strokeWidth="1" strokeLinecap="round" />

      {/* Gold checkmark on the crown */}
      <path
        d="M17.3 22.6l1.6 1.6 3-3.4"
        stroke="#0F3D3E"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
