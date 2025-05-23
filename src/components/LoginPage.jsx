// src/components/LoginPage.jsx
import React, { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import './LoginPage.css';

function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error al iniciar sesión con Google:", error);
      alert(`Error al iniciar sesión: ${error.message}`);
    }
  };

  const handleEmailAuth = async () => {
    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password);
        alert("Registro exitoso. ¡Has iniciado sesión!");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        alert("Sesión iniciada con éxito.");
      }
    } catch (error) {
      console.error("Error de autenticación por email:", error);
      alert(`Error: ${error.message}`);
    }
  };

  return (
    <div className="login-page">
      <h2>Bienvenido al Tutor Académico IA</h2>
      <p>Por favor, {isRegister ? 'regístrate' : 'inicia sesión'} para comenzar a aprender.</p>

      <button className="auth-button google" onClick={handleGoogleSignIn}>
        <img className="google-icon" src="https://upload.wikimedia.org/wikipedia/commons/4/4a/Logo_de_Google_%22G%22.svg" alt="Google icon" />
        Iniciar Sesión con Google
      </button>

      <form onSubmit={(e) => { e.preventDefault(); handleEmailAuth(); }} className="auth-form">
        <h3>{isRegister ? 'Registro con Email' : 'Acceso con Email'}</h3>
        <label htmlFor="email">Email:</label>
        <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" required />
        <label htmlFor="password">Contraseña:</label>
        <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
        
        <button type="submit">{isRegister ? 'Regístrate' : 'Iniciar Sesión'}</button>
        <a href="#" className="toggle-link" onClick={() => setIsRegister(!isRegister)}>
          {isRegister ? '¿Ya tienes cuenta? Inicia Sesión.' : '¿No tienes cuenta? Regístrate aquí.'}
        </a>
      </form>
    </div>
  );
}

export default LoginPage;