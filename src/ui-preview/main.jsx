import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import UiPreview from './UiPreview';
import './ui-preview.css';

createRoot(document.getElementById('ui-preview-root')).render(
  <StrictMode>
    <UiPreview />
  </StrictMode>
);
