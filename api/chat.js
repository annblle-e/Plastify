const fetch = require('node-fetch');

module.exports = async (req, res) => {
  try {
    const data = req.body;
    console.log(data);  // Log incoming request body

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    const response = await fetch('https://free.v36.cm/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: data.messages[0].content }],
      }),
    });

    if (!response.ok) {
      const errorDetails = await response.text();  // Capture detailed error
      console.error('Error details:', errorDetails);
      throw new Error('Network response was not ok');
    }

    const result = await response.json();
    res.json(result);  // Send back the response
  } catch (error) {
    console.error('Error:', error);  // Log the error
    res.status(500).json({ error: 'Internal server error' });
  }
};
