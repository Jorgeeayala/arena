import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Eye } from 'lucide-react';
import App from '../App';
import ExecutiveDashboard from './ExecutiveDashboard';
import './preview.css';

createRoot(document.getElementById('executive-preview-root')).render(
  <StrictMode>
    <div className="executive-preview-root">
      <div className="executive-preview-badge" role="status">
        <Eye size={15} />
        <span><strong>Preview ejecutivo</strong> · Sólo lectura</span>
      </div>
      <App
        readOnlyPreview
        uiMode="executive"
        periodOverviewComponent={ExecutiveDashboard}
      />
    </div>
  </StrictMode>
);
