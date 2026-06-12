import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { ConfigProvider, App as AntApp, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { router } from './router';
import { useApp } from './store';
import Aurora from '@/components/ui/Aurora';
import './styles/global.css';

useApp.getState().init();

function AuroraBackdrop() {
  return (
    <>
      <div className="aurora-stage">
        <Aurora
          colorStops={['#5EEAD4', '#A78BFA', '#5EEAD4']}
          amplitude={2.5}
          blend={0.8}
          speed={1.2}
        />
      </div>
      <div className="aurora-noise" />
    </>
  );
}

function RootShell() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#5EEAD4',
          colorBgBase: '#0A0A0F',
          colorTextBase: '#F5F5F0',
          fontFamily: 'Geist, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
          borderRadius: 12,
        },
      }}
    >
      <AntApp>
        <AuroraBackdrop />
        <RouterProvider router={router} />
      </AntApp>
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootShell />
  </React.StrictMode>
);
