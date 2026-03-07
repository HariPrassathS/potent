export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { model, messages, temperature, max_tokens } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const allowedModels = [
      'llama-3.3-70b-versatile',
      'meta-llama/llama-4-scout-17b-16e-instruct'
    ];
    const safeModel = allowedModels.includes(model) ? model : 'llama-3.3-70b-versatile';

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: safeModel,
        messages: messages,
        temperature: typeof temperature === 'number' ? Math.min(Math.max(temperature, 0), 2) : 0.85,
        max_tokens: typeof max_tokens === 'number' ? Math.min(max_tokens, 4096) : 1024
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
