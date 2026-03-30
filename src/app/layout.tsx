import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '무심천 데이트코스',
  description: '청주 무심천 주변 맛집 산책 가이드 지도',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}
