import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AdminLayout from './layout/AdminLayout'
import LoginPage from './pages/LoginPage'
import ModuleRoute from './pages/ModuleRoute'
import NotFoundPage from './pages/NotFoundPage'
import OrdersPage from './pages/OrdersPage'
import OverviewPage from './pages/OverviewPage'
import ProductsPage from './pages/ProductsPage'
import SettingsPage from './pages/SettingsPage'
import PixelPage from './pages/PixelPage'
import { AdminSessionProvider, RequireAdmin } from './session/AdminSession'
import './admin-base.css'
import './admin.css'
import './admin-layout.css'

// The back office is its own app (admin.html): no storefront header, footer, cart, catalog loading or Meta Pixel.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Kimish admin crashed:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: 'system-ui', color: '#222' }}>
          <h1>Kimish admin could not start</h1>
          <pre
            style={{ whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: 16, borderRadius: 12 }}
          >
            {String(this.state.error?.stack || this.state.error)}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <BrowserRouter>
      <AdminSessionProvider>
        <Routes>
          <Route path="/admin/login" element={<LoginPage />} />
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminLayout />
              </RequireAdmin>
            }
          >
            <Route index element={<OverviewPage />} />
            <Route path="overview" element={<Navigate to="/admin" replace />} />
            {/* Screens with their own page; every other screen uses the generic ModulePage */}
            <Route path="products" element={<ProductsPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="pixel" element={<PixelPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path=":slug" element={<ModuleRoute />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </AdminSessionProvider>
    </BrowserRouter>
  </ErrorBoundary>,
)
