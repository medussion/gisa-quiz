import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: '정보처리기사 실기 훈련기',
  description: '기출 중심 직접 입력형 풀이 · 오답 자동 재출제 · 모의고사',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f7f9' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1115' },
  ],
};

const NAV = [
  { href: '/', label: '홈' },
  { href: '/questions', label: '문제' },
  { href: '/review', label: '오답' },
  { href: '/exam', label: '모의고사' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-dvh">
        <header
          className="sticky top-0 z-20 border-b backdrop-blur"
          style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg) 88%, transparent)' }}
        >
          <nav className="mx-auto flex max-w-2xl items-center gap-1 px-3 py-2.5">
            <Link href="/" className="mr-auto text-[15px] font-bold tracking-tight">
              정보처리기사 실기
            </Link>
            {NAV.slice(1).map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded-lg px-2.5 py-1.5 text-[13px] font-medium"
                style={{ color: 'var(--text-dim)' }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-2xl px-3 pb-24 pt-4">{children}</main>
      </body>
    </html>
  );
}
