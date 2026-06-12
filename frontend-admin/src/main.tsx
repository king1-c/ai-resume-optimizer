import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { ConfigProvider, App as AntApp, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { router } from './router';
import { useApp } from './store';
import Silk from '@/components/ui/Silk';
import './styles/global.css';

useApp.getState().init();

function ConsoleShell() {
  return (
    <>
      <div className="silk-bg">
        <Silk color="#E5E1D8" noiseIntensity={1.5} speed={1.8} scale={1.8} />
      </div>
      <div className="grain-bg" />
      <ConfigProvider
        locale={zhCN}
        theme={{
          algorithm: theme.defaultAlgorithm,
          token: {
            colorPrimary: '#1A1A1A',
            colorError: '#DC2626',
            colorBgBase: '#FAFAF7',
            colorTextBase: '#1A1A1A',
            fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
            borderRadius: 8,
            controlHeight: 32,
          },
        }}
      >
        <AntApp>
          <RouterProvider router={router} />
        </AntApp>
      </ConfigProvider>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConsoleShell />
  </React.StrictMode>
);
