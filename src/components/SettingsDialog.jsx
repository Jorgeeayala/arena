import { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Loader2,
  Moon,
  ShieldCheck,
  Sun,
  Type,
  X,
} from 'lucide-react';

function cleanPin(value) {
  return value.replace(/\D/g, '').slice(0, 4);
}

export default function SettingsDialog({
  open,
  user,
  theme,
  fontScale = 'normal',
  fontScaleOptions = [],
  error,
  submitting,
  onClose,
  onChangePin,
  onThemeChange,
  onFontScaleChange,
}) {
  const [view, setView] = useState('main');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [localError, setLocalError] = useState('');

  if (!open) return null;

  const visibleError = localError || error || '';
  const canSubmitPin =
    currentPin.length === 4 &&
    newPin.length === 4 &&
    confirmation.length === 4 &&
    !submitting;

  function openPinView() {
    setCurrentPin('');
    setNewPin('');
    setConfirmation('');
    setLocalError('');
    setView('pin');
  }

  function close() {
    if (submitting) return;
    setLocalError('');
    setView('main');
    onClose();
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    if (currentPin.length !== 4 || newPin.length !== 4 || confirmation.length !== 4) {
      setLocalError('Completá los 4 dígitos en todos los campos.');
      return;
    }
    if (newPin !== confirmation) {
      setLocalError('El PIN nuevo no coincide en ambos campos.');
      return;
    }

    const selectedCurrent = currentPin;
    const selectedNew = newPin;
    setCurrentPin('');
    setNewPin('');
    setConfirmation('');
    setLocalError('');
    onChangePin(selectedCurrent, selectedNew);
  }

  return (
    <div
      className="team-modal-overlay"
      onClick={submitting ? undefined : close}
      role="presentation"
    >
      <div
        className="team-modal settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="team-modal-header">
          {view === 'main' ? (
            <div className="team-modal-title" id="settings-title">
              Configuración
            </div>
          ) : (
            <div className="team-modal-title settings-title-with-back">
              <button
                type="button"
                className="settings-back-btn"
                onClick={() => setView('main')}
                disabled={submitting}
                aria-label="Volver a configuración"
              >
                <ArrowLeft size={16} />
              </button>
              Cambiar mi PIN
            </div>
          )}
          <button
            type="button"
            className="team-modal-close"
            onClick={close}
            disabled={submitting}
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        {view === 'main' ? (
          <div className="settings-main">
            <section className="settings-section">
              <h3 className="settings-section-title">Preferencias</h3>
              <div className="settings-theme-options" role="group" aria-label="Tema de la aplicación">
                <button
                  type="button"
                  className={`settings-theme-option ${theme === 'light' ? 'is-active' : ''}`}
                  onClick={() => onThemeChange('light')}
                >
                  <Sun size={16} />
                  Claro
                </button>
                <button
                  type="button"
                  className={`settings-theme-option ${theme === 'dark' ? 'is-active' : ''}`}
                  onClick={() => onThemeChange('dark')}
                >
                  <Moon size={16} />
                  Oscuro
                </button>
              </div>

              {fontScaleOptions.length > 0 && (
                <div className="settings-subsection">
                  <div className="settings-subsection-header">
                    <span className="settings-subsection-title">
                      <Type size={15} />
                      Tamaño de texto
                    </span>
                    <span className="settings-font-preview" data-scale={fontScale}>
                      Aa
                    </span>
                  </div>
                  <div
                    className="settings-font-options"
                    role="group"
                    aria-label="Tamaño de texto de la aplicación"
                  >
                    {fontScaleOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={`settings-font-option ${
                          fontScale === option.id ? 'is-active' : ''
                        }`}
                        aria-pressed={fontScale === option.id}
                        onClick={() => onFontScaleChange?.(option.id)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <p className="settings-note">
                    Se aplica al instante y queda guardado en este dispositivo.
                  </p>
                </div>
              )}
            </section>

            <section className="settings-section">
              <h3 className="settings-section-title">Seguridad</h3>
              <button type="button" className="settings-action" onClick={openPinView}>
                <KeyRound size={16} />
                <span>Cambiar mi PIN</span>
              </button>
              <p className="settings-note">
                Actualiza tu PIN de 4 dígitos para volver a ingresar. Al
                confirmarlo, las sesiones anteriores de tu cuenta se cierran.
              </p>
            </section>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-pin-form settings-pin-form">
            <p className="pin-change-intro">
              Usuario: <strong>{user}</strong>. Ingresá tu PIN actual y elegí uno nuevo.
            </p>

            {visibleError && (
              <div className="error-banner auth-error-banner" role="alert">
                <AlertCircle size={18} />
                <span>{visibleError}</span>
              </div>
            )}

            <label className="auth-pin-label" htmlFor="settings-pin-current">
              PIN actual
            </label>
            <div className="auth-input-icon-wrap">
              <KeyRound size={17} />
              <input
                autoFocus
                id="settings-pin-current"
                className="auth-pin-input auth-pin-input-with-icon"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                pattern="[0-9]{4}"
                maxLength={4}
                value={currentPin}
                disabled={submitting}
                onChange={(event) => {
                  setCurrentPin(cleanPin(event.target.value));
                  setLocalError('');
                }}
              />
            </div>

            <label className="auth-pin-label" htmlFor="settings-pin-new">
              Nuevo PIN
            </label>
            <div className="auth-input-icon-wrap">
              <ShieldCheck size={17} />
              <input
                id="settings-pin-new"
                className="auth-pin-input auth-pin-input-with-icon"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                pattern="[0-9]{4}"
                maxLength={4}
                value={newPin}
                disabled={submitting}
                onChange={(event) => {
                  setNewPin(cleanPin(event.target.value));
                  setLocalError('');
                }}
              />
            </div>

            <label className="auth-pin-label" htmlFor="settings-pin-confirm">
              Repetir nuevo PIN
            </label>
            <div className="auth-input-icon-wrap">
              <CheckCircle2 size={17} />
              <input
                id="settings-pin-confirm"
                className="auth-pin-input auth-pin-input-with-icon"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                pattern="[0-9]{4}"
                maxLength={4}
                value={confirmation}
                disabled={submitting}
                onChange={(event) => {
                  setConfirmation(cleanPin(event.target.value));
                  setLocalError('');
                }}
              />
            </div>

            <button
              type="submit"
              className="btn-primary auth-submit-btn"
              disabled={!canSubmitPin}
            >
              {submitting ? (
                <>
                  <Loader2 size={17} className="animate-spin" /> Guardando…
                </>
              ) : (
                <>
                  <ShieldCheck size={17} /> Guardar nuevo PIN
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
