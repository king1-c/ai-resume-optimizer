import { useEffect, useRef } from 'react';
import { getResumes } from '@/api/resume';

// 后台心跳检查：定期验证账户是否仍然有效
// 被封禁的用户会在下一次心跳时被踢出
const CHECK_INTERVAL = 8_000; // 8 秒

export function useAccountStatus() {
  const timerRef = useRef<number | null>(null);
  const kickRef = useRef(false); // 防止重复踢出

  useEffect(() => {
    const kick = () => {
      if (kickRef.current) return;
      kickRef.current = true;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // 直接跳转，不依赖 message（避免 antd App 上下文问题）
      location.href = '/login?blocked=1';
    };

    const check = async () => {
      if (!localStorage.getItem('token') || kickRef.current) return;
      try {
        await getResumes(1, 1);
      } catch (e: any) {
        const code = e.response?.data?.code;
        if (code === 'ACCOUNT_DISABLED') {
          kick();
        }
      }
    };

    // 立即检查一次
    check();
    timerRef.current = window.setInterval(check, CHECK_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);
}
