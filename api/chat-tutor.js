// api/chat-tutor.js
import OpenAI from 'openai';

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
        openai = null;
    }
} else {
    console.warn("THALARIS_API_KEY NO ESTÁ DEFINIDA. La API de IA no funcionará.");
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método no permitido. Solo POST.' });
    }

    // AHORA RECIBIMOS EL MENSAJE Y TAMBIÉN EL HISTORIAL (contexto)
    const { message, conversationContext } = req.body; // <--- CAMBIO AQUÍ

    if (!message) {
        return res.status(400).json({ message: 'El mensaje del usuario es requerido.' });
    }
    if (!conversationContext || !Array.isArray(conversationContext)) { // Validar que el contexto sea un array
        return res.status(400).json({ message: 'El contexto de la conversación es requerido y debe ser un array.' });
    }

    if (!openai) {
        console.error("OpenAI client no inicializado en Vercel Function. THALARIS_API_KEY Missing?");
        return res.status(500).json({ message: 'Error interno: el servicio de IA no está configurado correctamente.' });
    }

    try {
        // Construir el array de mensajes para la API
        // Primero el sysprompt
        const messagesForAPI = [{ role: "system", content: SYSPROMPT }];

        // Luego añadir el historial de conversación recibido desde el frontend
        // Filtrar y mapear para asegurar el formato de la API (role: user/assistant, content: string)
        conversationContext.forEach(msg => {
            if (msg.sender === 'user' || msg.sender === 'bot') { // Solo mensajes de usuario o bot
                messagesForAPI.push({
                    role: msg.sender === 'user' ? 'user' : 'assistant', // Mapear 'bot' a 'assistant' para la API
                    content: msg.text
                });
            }
        });

        // Finalmente, añadir el mensaje actual del usuario
        messagesForAPI.push({ role: "user", content: message });


        const completion = await openai.chat.completions.create({
            model: MODEL_NAME,
            messages: messagesForAPI, // <--- Enviamos el array completo
            temperature: 0.7,
            max_tokens: 500,
        });

        const botResponse = completion.choices[0].message.content;
        res.status(200).json({ text: botResponse });

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