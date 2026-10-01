import type { ReactNode } from 'react';

export const metadata = {
  title: 'Issue 136 disposable fixture',
  description: 'Synthetic release-control proof fixture.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
