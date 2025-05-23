// api/chat-tutor.js
import OpenAI from 'openai';

// Variables de entorno (Vercel las inyectará)
const THALARIS_API_KEY = process.env.THALARIS_API_KEY; // ¡Configura esta en Vercel!
const BASE_URL = "https://llmapi.thalarislabs.com";
const MODEL_NAME = "gemini-2.0-flash";
const SYSPROMPT = "Eres un tutor académico muy amable y paciente. Tu objetivo es explicar conceptos complejos de forma sencilla, resolver dudas y guiar al estudiante en su aprendizaje. Siempre ofrece ejemplos claros y fomenta la curiosidad. Adapta tus explicaciones al nivel del usuario y al tema. Sé conciso pero completo.";

// Inicializa OpenAI si la API Key está disponible
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
    // Vercel Serverless Functions manejan CORS automáticamente para el mismo origen.
    // Si necesitas permitir dominios EXTERNOS (ej. para probar desde Postman/Insomnia),
    // necesitarías Headers CORS explícitos.
    /*
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); // Si necesitas autorización
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    */

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método no permitido. Solo POST.' });
    }

    const { message } = req.body;

    // Puedes añadir protección aquí (ej. verificar token de Firebase Auth que el frontend envíe)
    // Por ahora, cualquier POST a esta función responderá si el mensaje es válido.

    if (!message) {
        return res.status(400).json({ message: 'El mensaje del usuario es requerido.' });
    }

    if (!openai) {
        console.error("OpenAI client no inicializado en Vercel Function. THALARIS_API_KEY Missing?");
        return res.status(500).json({ message: 'Error interno: el servicio de IA no está configurado correctamente.' });
    }

    try {
        const messages = [
            { role: "system", content: SYSPROMPT },
            { role: "user", content: message },
        ];

        const completion = await openai.chat.completions.create({
            model: MODEL_NAME,
            messages: messages,
            temperature: 0.7,
            max_tokens: 500,
        });

        const botResponse = completion.choices[0].message.content;
        res.status(200).json({ text: botResponse });

    } catch (error) {
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