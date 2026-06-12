import { Outlet, useNavigate } from 'react-router-dom';
import { Button, Modal } from 'antd';
import { useState } from 'react';
import { useApp } from '@/store';
import BlurText from '@/components/ui/BlurText';
import Aurora from '@/components/ui/Aurora';

export default function PublicLayout() {
  const { token } = useApp();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const handleAction = (action: () => void) => {
    if (token) {
      action();
    } else {
      setPendingAction(() => action);
      setIsModalOpen(true);
    }
  };

  const handleLogin = () => {
    setIsModalOpen(false);
    navigate('/login');
  };

  const handleContinue = () => {
    setIsModalOpen(false);
    if (pendingAction) {
      pendingAction();
    }
  };

  return (
    <div className="public-shell">
      <div className="aurora-stage">
        <Aurora
          colorStops={['#5EEAD4', '#A78BFA', '#5EEAD4']}
          amplitude={2.5}
          blend={0.8}
          speed={1.2}
        />
      </div>
      <div className="aurora-noise" />

      <header className="public-nav">
        <div className="nav-brand">
          <span className="brand-mark">R</span>
          <span className="brand-text">RÉSUMÉ·AI</span>
        </div>
        <div className="nav-actions">
          {token ? (
            <Button type="primary" onClick={() => navigate('/app')}>
              进入应用
            </Button>
          ) : (
            <>
              <Button type="text" onClick={() => navigate('/login')}>
                登录
              </Button>
              <Button type="primary" onClick={() => navigate('/register')}>
                开始使用
              </Button>
            </>
          )}
        </div>
      </header>

      <main className="public-content">
        <Outlet context={{ handleAction }} />
      </main>

      <Modal
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        centered
        width={400}
        className="login-modal"
      >
        <div className="modal-content">
          <div className="modal-icon">🔒</div>
          <h3 className="modal-title">需要登录</h3>
          <p className="modal-desc">
            该功能需要登录后才能使用哦<br />
            登录后可享受完整的 AI 简历优化服务
          </p>
          <div className="modal-actions">
            <Button size="large" onClick={handleLogin} block>
              去登录
            </Button>
            <Button type="primary" size="large" onClick={handleContinue} block>
              继续试用
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
