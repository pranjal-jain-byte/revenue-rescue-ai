import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/shared/sidebar';

export const metadata: Metadata = {
  title: 'RevenueRescue AI — Detect. Diagnose. Recover. Stop.',
  description: 'Autonomous AI revenue recovery agent for merchants. Detect failed payments, diagnose failures, execute bounded recovery workflows with full audit trail.',
  keywords: ['revenue recovery', 'payment failure', 'fintech', 'AI agent', 'Razorpay'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
      </head>
      <body>
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          <Sidebar />
          <main style={{ flex: 1, minWidth: 0, overflowX: 'hidden' }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
