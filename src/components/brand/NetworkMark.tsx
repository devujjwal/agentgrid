export function NetworkMark({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M7 7h18v18H7V7Zm0 0 18 18M25 7 7 25M16 7v18M7 16h18"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path d="M12 16a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z" fill="currentColor" />
      <path d="M4 4h6v6H4zM22 4h6v6h-6zM4 22h6v6H4zM22 22h6v6h-6z" fill="currentColor" />
    </svg>
  );
}
