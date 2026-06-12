import { useInView, useMotionValue, useSpring } from 'motion/react';
import { useEffect, useRef } from 'react';

interface CountUpProps {
  to: number;
  from?: number;
  duration?: number;
  className?: string;
  suffix?: string;
  prefix?: string;
  decimals?: number;
}

export default function CountUp({
  to,
  from = 0,
  duration = 2,
  className = '',
  suffix = '',
  prefix = '',
  decimals = 0,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(from);
  const springValue = useSpring(motionValue, {
    damping: 30 + 30 * (1 / duration),
    stiffness: 120 * (1 / duration),
  });
  const isInView = useInView(ref, { once: true, margin: '0px' });

  useEffect(() => {
    if (isInView) {
      const timeoutId = setTimeout(() => motionValue.set(to), 0);
      return () => clearTimeout(timeoutId);
    }
  }, [isInView, motionValue, to]);

  useEffect(() => {
    return springValue.on('change', (latest) => {
      if (ref.current) {
        const value =
          decimals > 0 ? latest.toFixed(decimals) : Math.round(latest).toString();
        ref.current.textContent = `${prefix}${value}${suffix}`;
      }
    });
  }, [springValue, prefix, suffix, decimals]);

  useEffect(() => {
    if (ref.current) {
      const value =
        decimals > 0 ? from.toFixed(decimals) : Math.round(from).toString();
      ref.current.textContent = `${prefix}${value}${suffix}`;
    }
  }, [from, prefix, suffix, decimals]);

  return <span ref={ref} className={className} />;
}
