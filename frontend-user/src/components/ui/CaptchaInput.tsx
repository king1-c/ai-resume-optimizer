import { Input } from 'antd';
import Captcha from './Captcha';

// 阻止中文输入
const blockChineseInput = (e: React.CompositionEvent<HTMLInputElement>) => {
  e.preventDefault();
};

// 过滤中文字符
const filterChinese = (value: string) => {
  return value.replace(/[\u4e00-\u9fa5]/g, '');
};

interface CaptchaInputProps {
  value?: string;
  onChange?: (value: string) => void;
  onCaptchaChange: (code: string) => void;
}

export default function CaptchaInput({ value, onChange, onCaptchaChange }: CaptchaInputProps) {
  return (
    <div className="captcha-group">
      <Input
        size="large"
        maxLength={4}
        className="captcha-input-field"
        value={value || ''}
        onChange={(e) => {
          const v = filterChinese(e.target.value).replace(/\D/g, '');
          onChange?.(v);
        }}
        onCompositionStart={blockChineseInput}
      />
      <Captcha
        length={4}
        width={140}
        height={44}
        onChange={onCaptchaChange}
      />
    </div>
  );
}
