export default function BrandMark({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className="hxs-mark" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#181C22" />
      <circle cx="16" cy="16" r="12" fill="none" style={{ stroke: "var(--steel)" }} strokeWidth="2.4" />
      <circle cx="16" cy="16" r="6.5" style={{ fill: "var(--copper)" }} />
    </svg>
  );
}
