import { Navigate } from 'react-router-dom';
import { useApp } from '@/store';

export default function AdminRoute({ children }: { children: JSX.Element }) {
  const user = useApp((s) => s.user);
  return user?.role === 'admin' ? children : <Navigate to="/" replace />;
}
