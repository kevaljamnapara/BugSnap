import React from 'react';
import ReactDOM from 'react-dom/client';
import { Editor } from './Editor';

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <Editor />
    </React.StrictMode>,
  );
}
