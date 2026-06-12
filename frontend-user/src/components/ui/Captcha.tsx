import { useEffect, useRef } from 'react';
import { ReloadOutlined } from '@ant-design/icons';
import './Captcha.css';

interface CaptchaProps {
  length?: number;
  width?: number;
  height?: number;
  onChange: (code: string) => void;
}

// 生成 4 位随机数字字符串
const generateCode = (length: number): string => {
  let s = '';
  for (let i = 0; i < length; i++) {
    s += Math.floor(Math.random() * 10).toString();
  }
  return s;
};

// 随机颜色
const randomColor = (alpha = 1): string => {
  const r = Math.floor(Math.random() * 200);
  const g = Math.floor(Math.random() * 200);
  const b = Math.floor(Math.random() * 200);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export default function Captcha({ length = 4, width = 140, height = 44, onChange }: CaptchaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const codeRef = useRef<string>('');

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 生成新验证码
    const code = generateCode(length);
    codeRef.current = code;
    onChange(code);

    // 背景
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#FAFAF7');
    gradient.addColorStop(1, '#EFEDE6');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // 噪点
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = randomColor(0.3);
      ctx.fillRect(Math.random() * width, Math.random() * height, 2, 2);
    }

    // 干扰线
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = randomColor(0.5);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.random() * width, Math.random() * height);
      ctx.bezierCurveTo(
        Math.random() * width, Math.random() * height,
        Math.random() * width, Math.random() * height,
        Math.random() * width, Math.random() * height,
      );
      ctx.stroke();
    }

    // 文字
    const chars = code.split('');
    const cellWidth = width / (length + 1);
    chars.forEach((ch, i) => {
      const fontSize = 24 + Math.floor(Math.random() * 6);
      ctx.font = `700 ${fontSize}px "JetBrains Mono", "Consolas", monospace`;
      ctx.fillStyle = randomColor(0.9);
      const x = cellWidth * (i + 0.5);
      const y = height / 2 + 8;
      const angle = (Math.random() - 0.5) * 0.6;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    });
  };

  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="captcha-wrap">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="captcha-canvas"
        onClick={draw}
        title="点击刷新"
      />
      <button
        type="button"
        className="captcha-refresh"
        onClick={draw}
        title="换一张"
      >
        <ReloadOutlined /> 换一张
      </button>
    </div>
  );
}
