import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'sonner'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Toaster
      position="bottom-right"
      theme="dark"
      toastOptions={{
        style: {
          background: '#16213e',
          border: '1px solid #0f3460',
          color: '#e0e0e0',
        },
      }}
    />
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
