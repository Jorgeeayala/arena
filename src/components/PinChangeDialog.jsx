import { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Loader2,
  ShieldCheck,
  X,
} from 'lucide-react';

export default function PinChangeDialog({
  open,
  user,
  error,
  submitting,
  onClose,
  onSubmit,
}) {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [localError, setLocalError] = useState('');

  function update(setter, value) {
    setter(value.replace(/\D/g, '').slice(0, 4));
    setLocalError('');
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
    onSubmit(selectedCurrent, selectedNew);
  }

  if (!open) return null;

  const visibleError = localError || error || '';
  const canSubmit =
    currentPin.length === 4 &&
    newPin.length === 4 &&
    confirmation.length === 4 &&
    !submitting;

  return (
    <div
      className="team-modal-overlay"
      onClick={submitting ? undefined : onClose}
      role="presentation"
    >
      <div
        className="team-modal pin-change-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pin-change-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="team-modal-header">
          <div className="team-modal-title" id="pin-change-title">
            <KeyRound size={17} />
            Cambiar mi PIN
          </div>
          <button
            type="button"
            className="team-modal-close"
            onClick={onClose}
            disabled={submitting}
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        <p className="pin-change-intro">
          Actualizá tu PIN de 4 dígitos. Usuario: <strong>{user}</strong>. Al
          confirmarlo se cierran las sesiones anteriores de tu cuenta.
        </p>

        <form onSubmit={handleSubmit} className="auth-pin-form">
          {visibleError && (
            <div className="error-banner auth-error-banner" role="alert">
              <AlertCircle size={18} />
              <span>{visibleError}</span>
            </div>
          )}

          <label className="auth-pin-label" htmlFor="pin-change-current">
            PIN actual
          </label>
          <div className="auth-input-icon-wrap">
            <KeyRound size={17} />
            <input
              autoFocus
              id="pin-change-current"
              className="auth-pin-input auth-pin-input-with-icon"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              pattern="[0-9]{4}"
              maxLength={4}
              value={currentPin}
              disabled={submitting}
              onChange={(event) => update(setCurrentPin, event.target.value)}
              aria-invalid={Boolean(visibleError)}
            />
          </div>

          <label className="auth-pin-label" htmlFor="pin-change-new">
            Nuevo PIN
          </label>
          <div className="auth-input-icon-wrap">
            <ShieldCheck size={17} />
            <input
              id="pin-change-new"
              className="auth-pin-input auth-pin-input-with-icon"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              pattern="[0-9]{4}"
              maxLength={4}
              value={newPin}
              disabled={submitting}
              onChange={(event) => update(setNewPin, event.target.value)}
            />
          </div>

          <label className="auth-pin-label" htmlFor="pin-change-confirm">
            Repetir nuevo PIN
          </label>
          <div className="auth-input-icon-wrap">
            <CheckCircle2 size={17} />
            <input
              id="pin-change-confirm"
              className="auth-pin-input auth-pin-input-with-icon"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              pattern="[0-9]{4}"
              maxLength={4}
              value={confirmation}
              disabled={submitting}
              onChange={(event) => update(setConfirmation, event.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn-primary auth-submit-btn"
            disabled={!canSubmit}
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
      </div>
    </div>
  );
}
