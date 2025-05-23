// src/components/ChatPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { signOut } from 'firebase/auth';
import { collection, addDoc, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig'; // Importamos auth y db de firebaseConfig
import './ChatPage.css';

function ChatPage({ user }) {
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const chatMessagesRef = useRef(null);
  
  // Hook para cargar el historial de chat desde Firestore
  useEffect(() => {
    if (!user) return;

    const chatDocRef = collection(db, `users/${user.uid}/messages`);
    const q = query(chatDocRef, orderBy('timestamp'), limit(50));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setChatHistory(messages);
    }, (error) => {
      console.error("Error al cargar el historial del chat:", error);
      alert("Error al cargar el historial del chat.");
    });

    return () => unsubscribe();
  }, [user]);

  // Asegurar que el scroll esté siempre abajo cuando chatHistory cambie
  useEffect(() => {
    if (chatMessagesRef.current) {
        chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [chatHistory]);


  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    const userMessage = {
      text: message.trim(),
      sender: 'user',
      timestamp: Date.now(),
    };
    setChatHistory(prev => [...prev, userMessage]); // Añadir mensaje del usuario inmediatamente
    setMessage('');
    setIsLoading(true);

    try {
      // Guardar el mensaje del usuario en Firestore
      await addDoc(collection(db, `users/${user.uid}/messages`), userMessage);

      // LLAMADA A TU VERCEL FUNCTION (tu backend). ¡Aquí la URL importa!
      // En desarrollo local, será http://localhost:PORT/api/chat-tutor
      // En producción en Vercel, será /api/chat-tutor (relativa)
      const response = await fetch('/api/chat-tutor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Aquí puedes añadir el token de Firebase Auth si quieres proteger tu Vercel Function
          // 'Authorization': `Bearer ${await user.getIdToken()}`
        },
        body: JSON.stringify({ message: userMessage.text }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Error del servidor (${response.status})`);
      }

      const data = await response.json();
      const botResponse = {
        text: data.text,
        sender: 'bot',
        timestamp: Date.now(),
      };
      // Guardar la respuesta del bot en Firestore
      await addDoc(collection(db, `users/${user.uid}/messages`), botResponse);

    } catch (error) {
      console.error('Error al llamar a la función de chat:', error);
      addMessageToChat('bot', `Error: ${error.message || 'Ocurrió un error al comunicarse con el tutor.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      alert(`Error al cerrar sesión: ${error.message}`);
    }
  };

  // Función auxiliar para añadir mensajes al DOM si ocurre un error (no se guardará en Firestore automáticamente)
  const addMessageToChat = (sender, text) => {
    setChatHistory(prev => [...prev, { text, sender, timestamp: Date.now(), id: 'local-error-' + Date.now(), isTemp: true }]);
  };


  return (
    <div className="chat-page">
      <div className="chat-header">
        <h3>Tutor AI</h3>
        <div className="user-info">
          <span>{user.displayName || user.email}</span>
          <button onClick={handleLogout}>Cerrar Sesión</button>
        </div>
      </div>

      <div className="chat-messages" ref={chatMessagesRef}>
        {chatHistory.map((msg) => (
          <div key={msg.id || msg.timestamp} className={`message-bubble ${msg.sender} ${msg.isTemp ? 'error' : ''}`}>
            {msg.text}
          </div>
        ))}
        {isLoading && <div className="loading-indicator">El tutor está escribiendo...</div>}
      </div>

      <form className="chat-input-area" onSubmit={handleSendMessage}>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Escribe tu pregunta aquí..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading}>Enviar</button>
      </form>
    </div>
  );
}

export default ChatPage;