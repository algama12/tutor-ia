// api/chat-tutor.js
import OpenAI from 'openai';
import { stripHtml } from 'string-strip-html';

const THALARIS_API_KEY = process.env.THALARIS_API_KEY;
const BASE_URL = "https://llmapi.thalarislabs.com";
const MODEL_NAME = "gemini-2.0-flash";
const SYSPROMPT = "Eres un tutor académico muy amable y paciente. Tu objetivo es explicar conceptos complejos de forma sencilla, resolver dudas y guiar al estudiante en su aprendizaje. Siempre ofrece ejemplos claros y fomenta la curiosidad. Adapta tus explicaciones al nivel del usuario y al tema. Sé conciso pero completo.";

let openai = null;
if (THALARIS_API_KEY) {
    try {
        openai = new OpenAI({
            apiKey: THALARIS_API_KEY,
            baseURL: BASE_URL,
        });
        console.log("OpenAI client inicializado para Vercel Function.");
    } catch (e) {
        console.error("Error al inicializar OpenAI client en Vercel Function:", e.message, e.stack);
        openai = null; // Asegura que no se use una instancia rota
    }
} else {
    console.warn("THALARIS_API_KEY NO ESTÁ DEFINIDA. La API de IA no funcionará.");
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método no permitido. Solo POST.' });
    }

    const { message, conversationContext, generateTitle } = req.body; // <--- NUEVO: generateTitle

    if (!message && !generateTitle) { // Si no es para generar título, el mensaje es requerido
        return res.status(400).json({ message: 'El mensaje del usuario es requerido.' });
    }
    if (!conversationContext || !Array.isArray(conversationContext)) {
        return res.status(400).json({ message: 'El contexto de la conversación es requerido y debe ser un array.' });
    }

    if (!openai) {
        return res.status(500).json({ message: 'Error interno: el servicio de IA no está configurado.' });
    }

    try {
        const messagesForAPI = [{ role: "system", content: SYSPROMPT }];
        conversationContext.forEach(msg => {
            if (msg.sender === 'user' || msg.sender === 'bot') {
                 // Usamos stripHtml para los mensajes anteriores si ya están enlazados
                messagesForAPI.push({
                    role: msg.sender === 'user' ? 'user' : 'assistant',
                    content: stripHtml(msg.text).result // <--- Limpiar HTML si hay
                });
            }
        });
        messagesForAPI.push({ role: "user", content: stripHtml(message).result }); // <--- Limpiar HTML del mensaje actual

        let responseText;

        if (generateTitle) {
            // Lógica para generar título
            const titleMessages = [
                { role: "system", content: "Genera un título muy corto (máximo 5-7 palabras, sin comillas, directo, sin introducción) para la siguiente conversación académica. El título debe resumir el tema principal. Ejemplo: 'Ecuaciones Cuadráticas', 'Ley de Newton', 'Revolución Francesa'." },
                ...messagesForAPI // Usa el contexto de la conversación
            ];
            const titleCompletion = await openai.chat.completions.create({
                model: MODEL_NAME,
                messages: titleMessages,
                temperature: 0.5,
                max_tokens: 20, // Título corto
            });
            responseText = titleCompletion.choices[0].message.content.trim();
        } else {
            // Lógica normal de chat
            const completion = await openai.chat.completions.create({
                model: MODEL_NAME,
                messages: messagesForAPI,
                temperature: 0.7,
                max_tokens: 2000, // Tu límite de tokens para las respuestas
            });
            responseText = completion.choices[0].message.content;
        }
        res.status(200).json({ text: responseText });

    } catch (error) {
        // ... (manejo de errores, sin cambios) ...
        console.error("Error al llamar a la API de Thalaris Labs (Vercel):", error);
        let errorMessageClient = "Ocurrió un error al comunicarse con el tutor. Por favor, inténtalo de nuevo más tarde.";
        if (error.response) {
            console.error("Detalles del ERROR de respuesta (Vercel):", error.response.status, error.response.data);
            if (error.response.status === 401 || error.response.status === 403) {
                errorMessageClient = "Error de autenticación con el servicio del tutor. Por favor, contacta al administrador.";
            } else if (error.response.status === 429) {
                errorMessageClient = "Demasiadas solicitudes al tutor. Por favor, espera un momento antes de intentarlo de nuevo.";
            } else if (error.response.data && error.response.data.error && error.response.data.error.message) {
                errorMessageClient = `Error del servicio: ${error.response.data.error.message}`;
            }
        } else if (error.request) {
            errorMessageClient = "No se pudo conectar con el servicio del tutor. Revisa tu conexión o inténtalo más tarde.";
        } else {
            errorMessageClient = "Ocurrió un problema interno al preparar mi respuesta. Inténtalo de nuevo.";
        }
        res.status(500).json({ message: errorMessageClient });
    }
    }