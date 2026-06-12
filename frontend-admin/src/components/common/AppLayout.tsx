import { Link, useLocation, Outlet } from 'react-router-dom';
import {
  DashboardOutlined,
  TeamOutlined,
  FileTextOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { useApp } from '@/store';

export default function AppLayout() {
  const { user, logout } = useApp();
  const location = useLocation();

  const navItems = [
    { href: '/', label: '概览', icon: <DashboardOutlined />, end: true },
    { href: '/users', label: '用户管理', icon: <TeamOutlined /> },
    { href: '/resumes', label: '简历管理', icon: <FileTextOutlined /> },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link to="/" className="brand">
          <div className="brand-mark">
            <i /><i /><i /><i />
          </div>
          <span className="brand-text">
            智能简历优化
            <small>管理后台</small>
          </span>
        </Link>

        <div className="nav-section">
          <div className="nav-label">工作台</div>
          {navItems.map((item) => {
            const active = item.end
              ? location.pathname === item.href
              : location.pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`nav-link ${active ? 'active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="sidebar-foot">
          <div className="user-box">
            <div className="user-avatar">{user?.username?.[0]?.toUpperCase() ?? 'A'}</div>
            <div className="user-meta">
              <div className="u">{user?.username ?? 'admin'}</div>
              <div className="r">超级管理员</div>
            </div>
            <button
              className="btn-logout"
              onClick={() => {
                logout();
                window.location.href = '/login';
              }}
              title="退出"
            >
              <LogoutOutlined />
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
