import { BrowserRouter } from 'react-router-dom'
import { createRoot } from 'react-dom/client'
import App from '@rebel/studio/App'
f
const root = createRoot(document.getElementById('root')!)

// note: strict mode invokes lifecycle methods twice so that it's easier to spot bugs. i don't think we want this since our code is bug-free
root.render(
  // <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  // </React.StrictMode>
)
