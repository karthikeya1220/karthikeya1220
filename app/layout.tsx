import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'GitHub Streak Badge',
  description: 'GraphQL-powered GitHub streak badge generator',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
