import React from 'react'
import ReactDOM from 'react-dom/client'
import Admin from './Admin'
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
        <div style={{padding: 32, fontFamily: 'system-ui', color: '#222'}}>
          <h1>Kimish admin could not start</h1>
          <pre style={{whiteSpace:'pre-wrap', background:'#f5f5f5', padding:16, borderRadius:12}}>
            {String(this.state.error?.stack || this.state.error)}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(<ErrorBoundary><Admin /></ErrorBoundary>)
