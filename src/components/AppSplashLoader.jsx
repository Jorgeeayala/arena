import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2 } from 'lucide-react';

/**
 * Splash de arranque de la app.
 *
 * No simula un porcentaje: permanece visible hasta que la primera pantalla
 * informa que terminó su carga inicial y el logo/la interfaz ya tuvieron
 * oportunidad de renderizarse. Un mínimo corto evita un destello brusco y el
 * máximo impide que una conexión lenta bloquee el acceso a los skeletons o al
 * mensaje de error de la pantalla.
 */
export default function AppSplashLoader({
  logoSrc = '/logo-mj.png',
  ready = false,
  onFinished = null,
  message = 'Preparando el sistema...',
  minDurationMs = 600,
  maxDurationMs = 3000,
}) {
  const [showSplash, setShowSplash] = useState(true);
  const [minimumElapsed, setMinimumElapsed] = useState(false);
  const [logoReady, setLogoReady] = useState(false);
  const [uiPainted, setUiPainted] = useState(false);
  const finishedRef = useRef(false);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setShowSplash(false);
    if (onFinished) onFinished();
  }, [onFinished]);

  useEffect(() => {
    const timer = setTimeout(() => setMinimumElapsed(true), minDurationMs);
    return () => clearTimeout(timer);
  }, [minDurationMs]);

  useEffect(() => {
    // Dos frames garantizan que React haya pintado la pantalla que está detrás
    // del overlay antes de permitir que este desaparezca.
    let secondFrame;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setUiPainted(true));
    });

    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
    };
  }, []);

  useEffect(() => {
    const maximumWait = Math.max(minDurationMs, maxDurationMs);
    const timer = setTimeout(finish, maximumWait);
    return () => clearTimeout(timer);
  }, [finish, minDurationMs, maxDurationMs]);

  useEffect(() => {
    if (minimumElapsed && ready && logoReady && uiPainted) finish();
  }, [finish, logoReady, minimumElapsed, ready, uiPainted]);

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
                onLoad={() => setLogoReady(true)}
                onError={() => setLogoReady(true)}
              />
            </motion.div>

            <p className="splash-message">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              {message}
            </p>

            <div className="splash-progress" aria-hidden="true">
              <div className="splash-progress-track">
                <div className="splash-progress-fill" />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
