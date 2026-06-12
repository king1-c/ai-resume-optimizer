import { Navigate } from 'react-router-dom';
import { useApp } from '@/store';

export default function AuthRoute({ children }: { children: JSX.Element }) {
  const { user, token } = useApp();
  if (!token) return <Navigate to="/login" replace />;
  if (user?.role !== 'admin' && user?.role !== 'SUPER_ADMIN') return <Navigate to="/login" replace />;
  return children;
}
