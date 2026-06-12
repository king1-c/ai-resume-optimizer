import { Navigate } from 'react-router-dom';
import { useApp } from '@/store';

export default function AuthRoute({ children }: { children: JSX.Element }) {
  const token = useApp((s) => s.token);
  const initialized = useApp((s) => s.initialized);

  if (!initialized) return null;

  return token ? children : <Navigate to="/login" replace />;
}
