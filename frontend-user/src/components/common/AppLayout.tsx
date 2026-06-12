import { Outlet, useLocation } from 'react-router-dom';
import { useApp } from '@/store';
import PillNav from '@/components/ui/PillNav';

export default function AppLayout() {
  const user = useApp((s) => s.user);
  const location = useLocation();

  const items = [
    { label: '上传简历', href: '/app' },
    { label: '历史记录', href: '/app/history' },
  ];

  return (
    <div className="app-shell">
      <PillNav items={items} />
      <main className="app-content" key={location.pathname}>
        <Outlet />
      </main>
      <footer className="app-footer">
        <div className="row gap-2" style={{ justifyContent: 'space-between', width: '100%' }}>
          <span className="muted" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
            <span className="dot" /> © 2026 RÉSUMÉ·AI — Built with Agnes AI
          </span>
          <span className="faint" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
            v1.0.0
          </span>
        </div>
      </footer>
    </div>
  );
}
