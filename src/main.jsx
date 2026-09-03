import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import ExecutiveDashboard from './ui-executive/ExecutiveDashboard'
import './ui-executive/preview.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App uiMode="executive" periodOverviewComponent={ExecutiveDashboard} />
  </StrictMode>,
)
