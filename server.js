const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

// ===== ВАШИ ДАННЫЕ =====
const CLIENT_ID = "019d25fe-d451-7581-b931-748abffe3262";
const SECRET = "MDE5ZDI1ZmUtZDQ1MS03NTgxLWI5MzEtNzQ4YWJmZmUzMjYyOmIxNDc5NDZlLTEyMWMtNDM4MC04ZDdhLTYxYTU5ZGQ2M2QyMQ==";
const SCOPE = "GIGACHAT_API_PERS";
// ========================

let accessToken = null;
let tokenExpiry = null;

// Функция генерации RqUID (уникальный идентификатор запроса)
function generateRqUID() {
  return crypto.randomUUID();
}

// Получение Access Token строго по документации
async function getAccessToken() {
  // Если токен ещё жив (с запасом 5 минут)
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry - 300000) {
    console.log('✅ Используем существующий токен');
    return accessToken;
  }

  console.log('🔄 Запрашиваем новый токен...');
  
  // Формируем Authorization Basic
  const authString = Buffer.from(`${CLIENT_ID}:${SECRET}`).toString('base64');
  const rqUid = generateRqUID();
  
  try {
    const response = await fetch('https://ngw.devices.sberbank.ru:9443/api/v2/oauth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'Authorization': `Basic ${authString}`,
        'RqUID': rqUid
      },
      body: `scope=${SCOPE}`
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Ошибка получения токена:', response.status, errorText);
      throw new Error(`Ошибка авторизации: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    accessToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in || 1800) * 1000;
    
    console.log('✅ Токен получен, expires_in:', data.expires_in);
    return accessToken;
    
  } catch (error) {
    console.error('❌ Ошибка при запросе токена:', error.message);
    throw error;
  }
}

// GET-эндпоинт для проверки работоспособности сервера
app.get('/api/chat', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Сервер работает. Используйте POST-запросы.',
    timestamp: new Date().toISOString()
  });
});

// POST-эндпоинт для чата
app.post('/api/chat', async (req, res) => {
  console.log('📩 Получен POST-запрос на /api/chat');
  
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Отсутствует поле message' });
    }
    
    // Получаем актуальный токен
    const token = await getAccessToken();
    
    // Формируем запрос к GigaChat API
    const messages = [
      { 
        role: 'system', 
        content: 'Ты — эксперт по химии. Отвечай на русском языке, подробно, с примерами. Генерируй задания из ФИПИ, ОГЭ, ЕГЭ.' 
      },
      { role: 'user', content: message }
    ];
    
    console.log('🔄 Отправляем запрос к GigaChat...');
    
    const response = await fetch('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        model: 'GigaChat-MAX',
        messages: messages,
        temperature: 0.7,
        max_tokens: 1024
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ GigaChat API error:', response.status, errorText);
      return res.status(response.status).json({ 
        error: `GigaChat API error: ${response.status}`,
        details: errorText
      });
    }
    
    const data = await response.json();
    const reply = data.choices[0].message.content;
    
    console.log('✅ Ответ получен, длина:', reply.length);
    res.json({ reply });
    
  } catch (error) {
    console.error('❌ Ошибка в прокси:', error.message);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 GigaChat Proxy запущен на порту ${PORT}`);
  console.log(`📍 GET проверка: https://localhost:${PORT}/api/chat`);
});
