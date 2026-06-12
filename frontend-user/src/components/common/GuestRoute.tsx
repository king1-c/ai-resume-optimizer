import { Navigate } from 'react-router-dom';
import { useApp } from '@/store';

export default function GuestRoute({ children }: { children: JSX.Element }) {
  const token = useApp((s) => s.token);
  return token ? <Navigate to="/" replace /> : children;
}
