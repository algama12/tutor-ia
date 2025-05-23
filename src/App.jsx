// src/App.jsx
import React from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from './firebaseConfig';
import './App.css'; // Estilos globales

import LoginPage from './components/LoginPage';
import ChatPage from './components/ChatPage';

function App() {
  const [user, loading, error] = useAuthState(auth);

  if (loading) {
    return <div className="loading-screen">Cargando...</div>;
  }

  if (error) {
    return <div className="error-screen">Error: {error.message}</div>;
  }

  return (
    <div className="app-container">
      {user ? <ChatPage user={user} /> : <LoginPage />}
    </div>
  );
}

export default App;