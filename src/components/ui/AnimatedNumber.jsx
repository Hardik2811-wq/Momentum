import React, { useEffect, useState, useRef } from 'react';

export default function AnimatedNumber({ value, className = '' }) {
  const [prev, setPrev] = useState(value);
  const [current, setCurrent] = useState(value);
  const [animating, setAnimating] = useState(false);
  const direction = useRef('up');

  useEffect(() => {
    if (value !== current) {
      direction.current = value > current ? 'up' : 'down';
      setPrev(current);
      setCurrent(value);
      setAnimating(true);
      const timer = setTimeout(() => setAnimating(false), 500);
      return () => clearTimeout(timer);
    }
  }, [value, current]);

  return (
    <span className={`inline-flex overflow-hidden relative ${className}`}>
      <span className="invisible">{current}</span>
      
      {animating && (
        <span 
          className="absolute inset-0 flex items-center justify-center animate-slideOut"
          style={{
            animation: direction.current === 'up' 
              ? 'odometerOutUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards' 
              : 'odometerOutDown 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards'
          }}
        >
          {prev}
        </span>
      )}

      <span 
        className="absolute inset-0 flex items-center justify-center"
        style={{
          animation: animating 
            ? (direction.current === 'up' 
                ? 'odometerInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards' 
                : 'odometerInDown 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards')
            : 'none'
        }}
      >
        {current}
      </span>
    </span>
  );
}
