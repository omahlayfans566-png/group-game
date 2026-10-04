import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import IntroScreen from './components/shared/IntroScreen';
import './index.css';

// Show intro only once per browser session
const SESSION_KEY = 'sg_intro_done';
const alreadyDone = sessionStorage.getItem(SESSION_KEY) === '1';

function Root() {
  const [introDone, setIntroDone] = useState(alreadyDone);

  const handleIntroComplete = () => {
    sessionStorage.setItem(SESSION_KEY, '1');
    setIntroDone(true);
  };

  return (
    <>
      {/* The app renders beneath the intro at all times */}
      <BrowserRouter>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#0f0f1a',
              color: '#f1f5f9',
              border: '1px solid #26263c',
              borderRadius: '8px',
              fontSize: '14px',
            },
            success: { iconTheme: { primary: '#00b3b3', secondary: '#0f0f1a' } },
            error: { iconTheme: { primary: '#e63333', secondary: '#0f0f1a' } },
          }}
        />
      </BrowserRouter>

      {/* Intro overlays the app until it completes */}
      {!introDone && <IntroScreen onComplete={handleIntroComplete} />}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
