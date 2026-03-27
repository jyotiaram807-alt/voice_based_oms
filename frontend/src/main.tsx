
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Make sure viewport meta tag is in the HTML head (index.html)
// <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />

createRoot(document.getElementById("root")!).render(<App />);
