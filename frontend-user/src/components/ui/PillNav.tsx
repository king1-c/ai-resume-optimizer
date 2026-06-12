import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '@/store';
import './PillNav.css';

interface NavItem {
  label: string;
  href: string;
}

interface PillNavProps {
  items: NavItem[];
}

export default function PillNav({ items }: PillNavProps) {
  const { user, logout } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [showLabel, setShowLabel] = useState(true);

  useEffect(() => {
    const handler = () => setShowLabel(window.innerWidth > 640);
    handler();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <header className="pill-nav-wrap">
      <div className="pill-nav-inner">
        <Link to="/" className="brand">
          <span className="brand-mark">R</span>
          <span className="brand-text">RÉSUMÉ·AI</span>
        </Link>

        <nav className="nav-pill">
          {items.map((item) => {
            const active = location.pathname === item.href;
            return (
              <Link key={item.href} to={item.href} className={`nav-link ${active ? 'active' : ''}`}>
                <span className="nav-link-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="nav-actions">
          {user ? (
            <>
              <span className="user-chip">
                <span className="dot" />
                {user.username}
                {user.role === 'admin' && <span className="admin-tag">ADMIN</span>}
              </span>
              <button className="btn-ghost" onClick={handleLogout}>
                退出
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-ghost">
                登录
              </Link>
              <Link to="/register" className="btn-primary">
                开始使用
              </Link>
            </>
          )}
        </div>

        <button className="hamburger" onClick={() => setIsOpen(!isOpen)} aria-label="menu">
          <span className={`bar ${isOpen ? 'open' : ''}`} />
          <span className={`bar ${isOpen ? 'open' : ''}`} />
        </button>
      </div>

      {isOpen && (
        <div className="mobile-menu">
          {items.map((item) => (
            <Link key={item.href} to={item.href} className="mobile-link" onClick={() => setIsOpen(false)}>
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
