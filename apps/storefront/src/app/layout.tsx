import type { Metadata } from 'next';
import '@showora/ui/styles.css';
export const metadata: Metadata = {
  title: 'SHOWORA — Website doanh nghiệp',
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
