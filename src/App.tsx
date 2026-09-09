import { useState, useEffect } from 'react';
import { LandingPage } from './components/LandingPage';
import { DemoApp } from './DemoApp';

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handleLocationChange);
    
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  if (currentPath === '/demo') {
    return <DemoApp />;
  }

  return <LandingPage />;
}
