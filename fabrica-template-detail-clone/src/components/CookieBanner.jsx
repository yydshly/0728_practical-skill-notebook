export default function CookieBanner({ accepted, onAccept }) {
  if (accepted) return null;

  return (
    <aside className="cookie-banner" aria-label="Cookie notice">
      <p>We use cookies</p>
      <button type="button" onClick={onAccept}>Accept</button>
    </aside>
  );
}
