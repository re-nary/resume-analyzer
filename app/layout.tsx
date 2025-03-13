import './globals.css';  // この行でインポートしています
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'レジュメ評価システム',
  description: 'レジュメを分析し、JDとのマッチング評価を行うシステム',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body suppressHydrationWarning={true}>
        {children}
      </body>
    </html>
  );
}