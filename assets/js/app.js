import React from 'react';
   import { createRoot } from 'react-dom/client';
   import { Socket } from 'phoenix';
   import App from './App';

   window.Phoenix = { Socket };

   const container = document.getElementById('root');
   const root = createRoot(container);
   root.render(<App />);