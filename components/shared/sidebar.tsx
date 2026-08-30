'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  AlertTriangle,
  Play,
  ScrollText,
  Shield,
  UserCheck,
  Zap,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/cases', icon: AlertTriangle, label: 'Revenue Cases' },
  { href: '/simulation', icon: Play, label: 'Simulation' },
  { href: '/audit', icon: ScrollText, label: 'Audit Trail' },
  { href: '/policies', icon: Shield, label: 'Policies' },
  { href: '/escalations', icon: UserCheck, label: 'Escalations' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="sidebar"
      style={{
        width: 220,
        minWidth: 220,
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
      }}
    >
      {/* Logo */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32,
            height: 32,
            background: 'linear-gradient(135deg, #2d68ff 0%, #a855f7 100%)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Zap size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              RevenueRescue
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>
              AI Agent
            </div>
          </div>
        </div>
      </div>

      {/* Synthetic Data Notice */}
      <div style={{
        margin: '12px 12px 0',
        padding: '8px 10px',
        background: 'rgba(255,165,2,0.08)',
        border: '1px solid rgba(255,165,2,0.2)',
        borderRadius: 6,
        fontSize: 10,
        color: 'var(--accent-yellow)',
        lineHeight: 1.5,
      }}>
        📊 Demo Mode — Synthetic data.<br />
        All transactions use mock provider. No real money moved.
      </div>

      {/* Navigation */}
      <nav style={{ padding: '12px 8px', flex: 1 }}>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                borderRadius: 6,
                marginBottom: 2,
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: active ? 'var(--bg-elevated)' : 'transparent',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
                border: active ? '1px solid var(--border)' : '1px solid transparent',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                }
              }}
            >
              <Icon size={14} style={{ opacity: active ? 1 : 0.6 }} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>Razorpay Buildathon 2024</div>
          <div>Track 03: AI Revenue Recovery</div>
        </div>
      </div>
    </aside>
  );
}
