const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

const CLIENT_ID = "019d25fe-d451-7581-b931-748abffe3262";
const SECRET = "MDE5ZDI1ZmUtZDQ1MS03NTgxLWI5MzEtNzQ4YWJmZmUzMjYyOmIxNDc5NDZlLTEyMWMtNDM4MC04ZDdhLTYxYTU5ZGQ2M2QyMQ==";
const SCOPE = "GIGACHAT_API_PERS";

let accessToken = null;
let tokenExpiry = null;

function generateRqUID() {
  return crypto.randomUUID();
}

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
      'RqUID': generateRqUID()
    },
    body: `scope=${SCOPE}`
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ошибка получения токена: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in || 1800) * 1000;
  return accessToken;
}

app.get('/api/chat', (req, res) => {
  res.json({ status: 'ok', message: 'GigaChat Proxy работает' });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Отсутствует поле message' });
    }

    const token = await getAccessToken();
    
    const response = await fetch('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        model: 'GigaChat-MAX',
        messages: [
          { role: 'system', content: 'Ты — эксперт по химии. Отвечай на русском языке, подробно, с примерами. Генерируй задания из ФИПИ, ОГЭ, ЕГЭ.' },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 1024
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: `GigaChat API error: ${response.status}` });
    }

    const data = await response.json();
    res.json({ reply: data.choices[0].message.content });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Proxy запущен на порту ${PORT}`));
