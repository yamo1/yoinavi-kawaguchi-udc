import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "酔ナビ 川口 - 飲み会帰りのセーフルートマップ",
  description: "飲み会前後の動線に特化した地図アプリ。居酒屋やコンビニ等の立ち寄り先と、安全な徒歩ルートを一画面で提示します。",
  keywords: ["地図", "安全", "ルート", "川口市", "川口駅", "帰宅"],
  openGraph: {
    title: "酔ナビ 川口 - 飲み会帰りのセーフルートマップ",
    description: "安全スコアに基づく徒歩ルートを提案。明るく人通りの多い道を優先し、途中のコンビニ・交番などを表示。",
    locale: "ja_JP",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🍺</text></svg>" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
