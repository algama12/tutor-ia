// src/components/ChatPage.jsx (VERSIÓN MEJORADA CON CONTEXTO Y MÚLTIPLES CONVERSACIONES)
import React, { useState, useEffect, useRef } from 'react';
import { signOut } from 'firebase/auth';
import { collection, addDoc, query, orderBy, limit, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore'; // Nuevas importaciones de Firestore
import { auth, db } from '../firebaseConfig';
import './ChatPage.css';
import ReactMarkdown from 'react-markdown';

function ChatPage({ user }) {
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const chatMessagesRef = useRef(null);

  // ESTADOS PARA GESTIÓN DE CONVERSACIONES
  const [conversations, setConversations] = useState([]); // Lista de todas las conversaciones del usuario
  const [currentConversationId, setCurrentConversationId] = useState(null); // ID de la conversación actual
  const [currentConversationTitle, setCurrentConversationTitle] = useState('Nueva Conversación'); // Título de la conversación actual

  // --- HOOK: Cargar todas las conversaciones del usuario ---
  useEffect(() => {
    if (!user) return;

    const qConversations = query(
      collection(db, `users/${user.uid}/conversations`),
      orderBy('createdAt', 'desc') // Ordenar por fecha de creación, las más recientes primero
    );

    const unsubscribeConversations = onSnapshot(qConversations, (snapshot) => {
      const loadedConversations = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setConversations(loadedConversations);

      // Si no hay ninguna conversación activa o el usuario acaba de loguearse,
      // crea una nueva o activa la más reciente.
      if (!currentConversationId && loadedConversations.length > 0) {
        selectConversation(loadedConversations[0].id, loadedConversations[0].title);
      } else if (!currentConversationId && loadedConversations.length === 0) {
        // Si no hay conversaciones, iniciamos una nueva
        startNewConversation();
      }
    }, (error) => {
      console.error("Error al cargar la lista de conversaciones:", error);
    });

    return () => unsubscribeConversations();
  }, [user, currentConversationId]); // Importante: dependencia de currentConversationId para reactivar la "primera carga" si se borra la actual.


  // --- HOOK: Suscribirse a los mensajes de la CONVERSACIÓN ACTUAL ---
  useEffect(() => {
    if (!user || !currentConversationId) {
      setChatHistory([]); // Limpiar historial si no hay conversación activa
      return;
    }

    const qMessages = query(
      collection(db, `users/${user.uid}/conversations/${currentConversationId}/messages`),
      orderBy('timestamp', 'asc') // Ordenar mensajes cronológicamente
    );

    const unsubscribeMessages = onSnapshot(qMessages, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setChatHistory(messages);
      // Asegúrate de hacer scroll al nuevo mensaje después de actualizar el historial
      // Pequeño delay para que el DOM se actualice antes de hacer scroll
      setTimeout(() => {
        if (chatMessagesRef.current) {
          chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
        }
      }, 100);
    }, (error) => {
      console.error("Error al cargar los mensajes de la conversación:", error);
      alert("Error al cargar los mensajes de la conversación.");
    });

    return () => unsubscribeMessages();
  }, [user, currentConversationId]); // Reacciona al cambio de usuario o de conversación activa

  // --- FUNCIÓN: Iniciar una nueva conversación ---
  const startNewConversation = async () => {
    setIsLoading(true);
    try {
      const newConversationRef = doc(collection(db, `users/${user.uid}/conversations`));
      const newConversationData = {
        title: 'Nueva Conversación ' + new Date().toLocaleTimeString(), // Título temporal
        createdAt: Date.now(),
      };
      await setDoc(newConversationRef, newConversationData);
      setCurrentConversationId(newConversationRef.id);
      setCurrentConversationTitle(newConversationData.title);
      setChatHistory([]); // Vaciamos el historial para la nueva conversación
      addMessageToChat('bot', '¡Hola! Soy tu tutor académico. ¿En qué puedo ayudarte hoy?', newConversationRef.id); // Mensaje inicial
    } catch (error) {
      console.error("Error al iniciar nueva conversación:", error);
      alert("Error al iniciar nueva conversación.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- FUNCIÓN: Seleccionar una conversación existente ---
  const selectConversation = (id, title) => {
    setCurrentConversationId(id);
    setCurrentConversationTitle(title);
    // chatHistory se actualizará automáticamente por el useEffect de mensajes
  };

  // --- FUNCIÓN: Eliminar una conversación ---
  const deleteConversation = async (id) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta conversación?')) {
      setIsLoading(true);
      try {
        await deleteDoc(doc(db, `users/${user.uid}/conversations/${id}`));
        // Si la conversación eliminada era la actual, iniciamos una nueva o seleccionamos otra
        if (id === currentConversationId) {
          setCurrentConversationId(null); // Desactivar la actual para que el useEffect de lista active otra o cree una
        }
      } catch (error) {
        console.error("Error al eliminar conversación:", error);
        alert("Error al eliminar conversación.");
      } finally {
        setIsLoading(false);
      }
    }
  };


  // --- FUNCIÓN: Enviar Mensaje ---
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() || isLoading || !currentConversationId) return; // No enviar si no hay conversación activa

    const userMessage = {
      text: message.trim(),
      sender: 'user',
      timestamp: Date.now(),
    };
    // No añadir al historial local directamente, Firestore lo hará.
    // setChatHistory(prev => [...prev, userMessage]); // <--- ELIMINADO para evitar duplicados con onSnapshot
    setMessage('');
    setIsLoading(true);

    try {
      // Guardar el mensaje del usuario en Firestore en la conversación actual
      await addDoc(collection(db, `users/${user.uid}/conversations/${currentConversationId}/messages`), userMessage);

      // --- PREPARAR CONTEXTO PARA LA IA ---
      // Mapear el historial actual para que la API lo entienda (solo 'user' y 'assistant')
      const conversationContextForAPI = chatHistory.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant', // 'bot' -> 'assistant'
        content: msg.text
      }));

      const response = await fetch('/api/chat-tutor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Enviamos el nuevo mensaje Y el contexto de la conversación
        body: JSON.stringify({
          message: userMessage.text,
          conversationContext: conversationContextForAPI // <--- AHORA ENVIAMOS EL CONTEXTO
        }),
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
      await addDoc(collection(db, `users/${user.uid}/conversations/${currentConversationId}/messages`), botResponse);

      // Si es la primera interacción y el título es genérico, proponemos uno nuevo
      if (chatHistory.length === 0 && currentConversationTitle.startsWith('Nueva Conversación')) {
        // En una app real, podrías pedir a la IA que genere un título para la conversación basado en el primer mensaje
        const newTitle = userMessage.text.substring(0, 30) + '...'; // Ejemplo simple
        await setDoc(doc(db, `users/${user.uid}/conversations/${currentConversationId}`), { title: newTitle }, { merge: true });
        setCurrentConversationTitle(newTitle); // Actualiza el título en el estado
      }

    } catch (error) {
      console.error('Error al llamar a la función de chat:', error);
      // Añadir mensaje de error localmente al historial
      addMessageToChat('bot', `Error: ${error.message || 'Ocurrió un error al comunicarse con el tutor.'}`, null, true);
    } finally {
      setIsLoading(false);
    }
  };

  // --- FUNCIÓN: Cerrar Sesión ---
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      alert(`Error al cerrar sesión: ${error.message}`);
    }
  };

  // --- FUNCIÓN AUXILIAR: Añadir mensaje local (solo para errores o mensajes iniciales del bot) ---
  const addMessageToChat = (sender, text, convId = currentConversationId, isTemp = false) => {
    // Al añadir mensaje al historial local usamos un ID temporal para evitar conflictos
    // Y marcamos si es temporal (solo para errores locales sin persistir en Firestore)
     setChatHistory(prev => [...prev, { text, sender, timestamp: Date.now(), id: 'local-' + Date.now(), isTemp: isTemp }]);
  };


  return (
    <div className="chat-page">
      <div className="sidebar"> {/* Barra lateral para conversaciones */}
        <div className="user-info-sidebar">
          <span>{user.displayName || user.email}</span>
        </div>
        <button className="new-chat-button" onClick={startNewConversation} disabled={isLoading}>
          + Nueva Conversación
        </button>
        <div className="conversations-list">
          {conversations.map((conv) => (
            <div 
              key={conv.id} 
              className={`conversation-item ${conv.id === currentConversationId ? 'active' : ''}`}
            >
              <span onClick={() => selectConversation(conv.id, conv.title)}>{conv.title}</span>
              <button onClick={() => deleteConversation(conv.id)} className="delete-conv-button">
                &#x2715; {/* X para eliminar */}
              </button>
            </div>
          ))}
        </div>
        <button className="logout-button-sidebar" onClick={handleLogout}>Cerrar Sesión</button>
      </div>

      <div className="main-chat-area"> {/* Área principal del chat */}
        <div className="chat-header-main">
          <h3>{currentConversationTitle}</h3>
          {/* El botón de cerrar sesión también puede estar arriba si lo prefieres */}
        </div>

        <div className="chat-messages" ref={chatMessagesRef}>
          {chatHistory.map((msg) => (
            <div 
              key={msg.id || msg.timestamp} 
              className={`message-bubble ${msg.sender} ${msg.isTemp ? 'error' : ''}`}
            >
              <ReactMarkdown>{msg.text}</ReactMarkdown>
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
            disabled={isLoading || !currentConversationId} // Deshabilitar si no hay conv activa
          />
          <button type="submit" disabled={isLoading || !currentConversationId}>Enviar</button>
        </form>
      </div>
    </div>
  );
}

export default ChatPage;