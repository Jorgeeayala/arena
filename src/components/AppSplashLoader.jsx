import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2 } from 'lucide-react';

/**
 * Splash de arranque de la app.
 * El logo de MJ Estudio Contable vive en public/logo-mj.png — es el
 * visual principal. El video con croma (ChromaVideoLoader) queda como
 * opcional por si más adelante se quiere una animación encima.
 */
export default function AppSplashLoader({
  logoSrc = '/logo-mj.png',
  onFinished = null,
  message = 'Cargando recursos del Estudio Contable...',
  minDurationMs = 2400,
}) {
  const [showSplash, setShowSplash] = useState(true);
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    let hideTimer;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 92) return 92;
        return Math.min(92, prev + Math.floor(Math.random() * 12 + 6));
      });
    }, 220);

    const timer = setTimeout(() => {
      setProgress(100);
      hideTimer = setTimeout(() => {
        setShowSplash(false);
        if (onFinished) onFinished();
      }, 420);
    }, minDurationMs);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [minDurationMs, onFinished]);

  return (
    <AnimatePresence>
      {showSplash && (
        <motion.div
          key="app-splash"
          className="splash-overlay"
          role="status"
          aria-live="polite"
          aria-busy="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <div className="splash-inner">
            <motion.div
              className="splash-logo-wrap"
              initial={{ opacity: 0, scale: 0.86 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 240, damping: 22, delay: 0.06 }}
            >
              <span className="splash-logo-glow" aria-hidden="true" />
              <img
                className="splash-logo"
                src={logoSrc}
                alt="MJ Estudio Contable"
                draggable="false"
              />
            </motion.div>

            <p className="splash-message">{message}</p>

            <div className="splash-progress">
              <div className="splash-progress-track">
                <motion.div
                  className="splash-progress-fill"
                  initial={{ width: '0%' }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.28, ease: 'easeOut' }}
                />
              </div>
              <div className="splash-progress-meta">
                <span className="splash-progress-label">
                  <Loader2 size={12} className="animate-spin" />
                  Cargando sistema...
                </span>
                <strong className="splash-progress-pct">{progress}%</strong>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
