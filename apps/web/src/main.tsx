import React from 'react'
import ReactDOM from 'react-dom/client'
import 'antd/dist/reset.css'
import '@/assets/main.css'
import '@/assets/app-shell.css'
import '@/assets/glass.css'
import '@/assets/library.css'
import '@/assets/reader.css'
import '@/i18n/setup'
import App from '@/app/App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
