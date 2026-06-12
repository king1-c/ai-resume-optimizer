import { Navigate } from 'react-router-dom';
import { useApp } from '@/store';

export default function GuestRoute({ children }: { children: JSX.Element }) {
  const { user, token } = useApp();
  if (token && (user?.role === 'admin' || user?.role === 'SUPER_ADMIN')) return <Navigate to="/" replace />;
  return children;
}
