import React from 'react';
import { createRoot } from 'react-dom/client';
import { Chat } from './Chat';

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <Chat />
    </React.StrictMode>,
  );
}
