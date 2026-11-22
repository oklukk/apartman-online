// Isolated fixture only. Never imported by the production entry point.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../../../src/App';
createRoot(document.getElementById('preview-root')!).render(<App />);
