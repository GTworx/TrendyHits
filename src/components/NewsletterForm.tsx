import { useState, type FormEvent } from 'react';
import { useI18n } from '../i18n';

type Status = 'idle' | 'sending' | 'success' | 'error' | 'invalid';

export function NewsletterForm() {
  const { t, lang } = useI18n();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setStatus('invalid');
    setStatus('sending');
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, language: lang }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error);
      setStatus('success');
      setEmail('');
    } catch {
      setStatus('error');
    }
  }

  const message =
    status === 'success' ? t('newsletter.success')
    : status === 'error' ? t('newsletter.error')
    : status === 'invalid' ? t('newsletter.invalid')
    : null;

  return (
    <section className="rounded-2xl bg-gradient-to-br from-rose-500 via-fuchsia-600 to-indigo-600 p-6 text-white shadow-lg sm:p-8">
      <div className="mx-auto max-w-xl text-center">
        <h2 className="text-2xl font-extrabold tracking-tight">{t('newsletter.title')}</h2>
        <p className="mt-1 text-sm text-white/85">{t('newsletter.description')}</p>
        <form onSubmit={onSubmit} noValidate className="mt-5 flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (status !== 'sending') setStatus('idle');
            }}
            placeholder={t('newsletter.placeholder')}
            aria-label={t('newsletter.placeholder')}
            autoComplete="email"
            className="min-w-0 flex-1 rounded-full border border-white/30 bg-white/15 px-4 py-2.5 text-white placeholder-white/70 outline-none focus:border-white focus:bg-white/20"
          />
          <button
            type="submit"
            disabled={status === 'sending'}
            className="rounded-full bg-white px-5 py-2.5 font-semibold text-zinc-900 transition hover:bg-zinc-100 disabled:opacity-70"
          >
            {status === 'sending' ? t('newsletter.sending') : t('newsletter.submit')}
          </button>
        </form>
        <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm font-medium">
          {message}
        </p>
      </div>
    </section>
  );
}
