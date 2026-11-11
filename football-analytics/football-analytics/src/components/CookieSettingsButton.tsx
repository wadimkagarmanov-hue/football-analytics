'use client';

export default function CookieSettingsButton() {
  return (
    <button type="button" className="underline hover:text-fg" onClick={() => window.dispatchEvent(new Event('open-consent'))}>
      Настройки cookie
    </button>
  );
}
