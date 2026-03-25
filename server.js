const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

// ===== ВАШИ ДАННЫЕ (уже подставлены) =====
const CLIENT_ID = "019d25fe-d451-7581-b931-748abffe3262";
const SECRET = "MDE5ZDI1ZmUtZDQ1MS03NTgxLWI5MzEtNzQ4YWJmZmUzMjYyOmIxNDc5NDZlLTEyMWMtNDM4MC04ZDdhLTYxYTU5ZGQ2M2QyMQ==";
const SCOPE = "GIGACHAT_API_PERS";
// =========================================

let accessToken = null;
let tokenExpiry = null;

// Функция получения токена
async function getAccessToken() {
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry - 300000) {
    return accessToken;
  }
  const authString = Buffer.from(`${CLIENT_ID}:${SECRET}`).toString('base64');
  const response = await fetch('https://ngw.devices.sberbank.ru:9443/api/v2/oauth', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'Authorization': `Basic ${authString}`,
      'RqUID': require('crypto').randomUUID()
    },
    body: `scope=${SCOPE}`
  });
  if (!response.ok) throw new Error(`Ошибка получения токена: ${response.status}`);
  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in || 1800) * 1000;
  return accessToken;
}

// Эндпоинт для чата
app.post('/api/chat', async (req, res) => {
  try {
    const token = await getAccessToken();
    const { message } = req.body;
    const messages = [
      { role: 'system', content: 'Ты — эксперт по химии. Отвечай на русском языке, подробно, с примерами.' },
      { role: 'user', content: message }
    ];
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
      throw new Error(`GigaChat error: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    res.json({ reply: data.choices[0].message.content });
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Proxy запущен на http://localhost:${PORT}`);
});
