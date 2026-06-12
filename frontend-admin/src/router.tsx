import { createBrowserRouter, Navigate } from 'react-router-dom';
import AuthRoute from '@/components/common/AuthRoute';
import GuestRoute from '@/components/common/GuestRoute';
import AppLayout from '@/components/common/AppLayout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import UserList from '@/pages/UserList';
import ResumeList from '@/pages/ResumeList';

export const router = createBrowserRouter([
  { path: '/login', element: <GuestRoute><Login /></GuestRoute> },
  {
    path: '/',
    element: <AuthRoute><AppLayout /></AuthRoute>,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'users', element: <UserList /> },
      { path: 'resumes', element: <ResumeList /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
