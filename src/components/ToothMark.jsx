// A custom tooth mark — drawn as a simple geometric molar silhouette
// with a root-split notch, rendered in the brand teal on a gold ring.
// Not a stock icon: shape is hand-tuned for a small favicon-scale mark.
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
      <rect width="40" height="40" rx="11" fill="#0F3D3E" />
      <path
        d="M20 9c-2.6 0-4.1 1.4-5.6 1.4-1.9 0-3.4-1.1-5-1.1-2.1 0-3.4 1.9-3.4 4.5
           0 3.4 1.5 6.9 2.4 9.7.8 2.5 1.2 5.4 2.8 5.4 1.7 0 1.9-3.6 2.5-5.9.5-1.9
           1.2-3.1 2.3-3.1s1.8 1.2 2.3 3.1c.6 2.3.8 5.9 2.5 5.9 1.6 0 2-2.9 2.8-5.4
           .9-2.8 2.4-6.3 2.4-9.7 0-2.6-1.3-4.5-3.4-4.5-1.6 0-3.1 1.1-5 1.1"
        fill="#F7F5F0"
      />
      <circle cx="20" cy="15.4" r="1.15" fill="#C9A15A" />
    </svg>
  );
}
