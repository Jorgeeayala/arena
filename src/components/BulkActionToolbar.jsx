import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckSquare,
  UserCheck,
  Loader2,
  X,
  User,
  UserX,
  ChevronDown,
} from 'lucide-react';

export default function BulkActionToolbar({
  selectedCount,
  totalVisible,
  onSelectAll,
  onDeselectAll,
  teamUsers = [],
  currentUser = '',
  onAssign,
  loading = false,
  progress = null,
  toastMessage = null,
}) {
  const [selectedUser, setSelectedUser] = useState(() => {
    return teamUsers.length > 0 ? teamUsers[0] : currentUser || '';
  });

  // Keep selectedUser in sync if teamUsers change
  useEffect(() => {
    if (teamUsers.length > 0 && (!selectedUser || !teamUsers.includes(selectedUser)) && selectedUser !== '__unassign__') {
      setSelectedUser(teamUsers[0]);
    }
  }, [teamUsers, selectedUser]);

  if (selectedCount <= 0 && !loading && !toastMessage) {
    return null;
  }

  const isAllSelected = selectedCount >= totalVisible && totalVisible > 0;

  const content = (
    <AnimatePresence>
      {(selectedCount > 0 || loading || toastMessage) && (
        <div className="bulk-toolbar-portal-root">
          {/* Success / Feedback Toast if available */}
          {toastMessage && (
            <motion.div
              className="bulk-feedback-toast"
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              <UserCheck size={18} className="toast-icon-check" />
              <span>{toastMessage}</span>
            </motion.div>
          )}

          {/* Floating Persistent Toolbar */}
          {(selectedCount > 0 || loading) && (
            <motion.div
              className="bulk-action-toolbar"
              initial={{ y: 80, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 80, opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            >
              {/* Left: Selection info & count */}
              <div className="bulk-toolbar-info">
                <div className="bulk-counter-pill">
                  <CheckSquare size={16} className="bulk-counter-icon" />
                  <span className="bulk-counter-text">
                    <strong>{selectedCount}</strong> {selectedCount === 1 ? 'seleccionado' : 'seleccionados'}
                  </span>
                </div>

                <div className="bulk-selection-toggles">
                  {!isAllSelected ? (
                    <button
                      type="button"
                      className="bulk-text-btn"
                      onClick={onSelectAll}
                      disabled={loading}
                      title={`Seleccionar todos los ${totalVisible} clientes visibles`}
                    >
                      Todos ({totalVisible})
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="bulk-text-btn"
                      onClick={onDeselectAll}
                      disabled={loading}
                      title="Deseleccionar todos"
                    >
                      Deseleccionar
                    </button>
                  )}
                </div>
              </div>

              {/* Center/Right: Assign Action & User Selector */}
              <div className="bulk-toolbar-actions">
                <div className="bulk-select-wrapper">
                  <User size={15} className="bulk-select-icon" />
                  <select
                    className="bulk-user-select"
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    disabled={loading}
                    aria-label="Seleccionar encargado para asignar"
                  >
                    <optgroup label="Miembros del equipo">
                      {teamUsers.map((u) => (
                        <option key={u} value={u}>
                          {u} {u === currentUser ? '(Tú)' : ''}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Acciones de estado">
                      <option value="__unassign__">❌ Desasignar (Sin Encargado)</option>
                    </optgroup>
                  </select>
                  <ChevronDown size={14} className="bulk-select-arrow" />
                </div>

                {/* 1-Click Execution Button */}
                <motion.button
                  type="button"
                  className={`btn-bulk-assign ${selectedUser === '__unassign__' ? 'btn-bulk-unassign' : ''}`}
                  whileHover={{ scale: loading ? 1 : 1.03 }}
                  whileTap={{ scale: loading ? 1 : 0.97 }}
                  onClick={() => onAssign && onAssign(selectedUser)}
                  disabled={loading || !selectedUser}
                  title={
                    selectedUser === '__unassign__'
                      ? `Desasignar los ${selectedCount} clientes seleccionados`
                      : `Asignar ${selectedCount} ${selectedCount === 1 ? 'cliente' : 'clientes'} a ${selectedUser} en un clic`
                  }
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="spin" />
                      <span>
                        {progress && progress.total > 0
                          ? `Asignando ${progress.done}/${progress.total}...`
                          : 'Asignando...'}
                      </span>
                    </>
                  ) : selectedUser === '__unassign__' ? (
                    <>
                      <UserX size={16} />
                      <span>Desasignar ({selectedCount})</span>
                    </>
                  ) : (
                    <>
                      <UserCheck size={16} />
                      <span className="btn-bulk-assign-label">
                        Asignar a <strong>{selectedUser}</strong>
                      </span>
                    </>
                  )}
                </motion.button>

                {/* Close / Cancel Button */}
                <button
                  type="button"
                  className="bulk-toolbar-close"
                  onClick={onDeselectAll}
                  disabled={loading}
                  title="Cerrar barra de acciones en lote"
                >
                  <X size={17} />
                </button>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
}
