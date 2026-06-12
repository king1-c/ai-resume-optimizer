import { createBrowserRouter, Navigate } from 'react-router-dom';
import AuthRoute from '@/components/common/AuthRoute';
import GuestRoute from '@/components/common/GuestRoute';
import AppLayout from '@/components/common/AppLayout';
import PublicLayout from '@/components/common/PublicLayout';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Upload from '@/pages/Upload';
import Result from '@/pages/Result';
import History from '@/pages/History';
import Landing from '@/pages/Landing';

export const router = createBrowserRouter([
  { path: '/login', element: <GuestRoute><Login /></GuestRoute> },
  { path: '/register', element: <GuestRoute><Register /></GuestRoute> },
  {
    path: '/',
    element: <PublicLayout />,
    children: [
      { index: true, element: <Landing /> },
    ],
  },
  {
    path: '/app',
    element: <AuthRoute><AppLayout /></AuthRoute>,
    children: [
      { index: true, element: <Upload /> },
      { path: 'result/:resumeId', element: <Result /> },
      { path: 'history', element: <History /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
