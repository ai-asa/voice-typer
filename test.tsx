import * as React from 'react';
import * as ReactDOM from 'react-dom/client';

const App = () => {
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">Test Component</h1>
      <p className="mt-2">This is a test component</p>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
