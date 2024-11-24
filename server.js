const express = require('express');
const puppeteer = require('puppeteer');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;  // Use process.env.PORT for dynamic port assignment
require('dotenv').config();

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/about.html');
});

app.get('/search', async (req, res) => {
    const keyword = req.query.keyword + " eco friendly";
    const url = `https://www.tokopedia.com/search?q=${encodeURIComponent(keyword)}&source=universe&st=product&srp_component_id=02.07.01.01`;

    try {
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--disable-http2']
        });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        await page.waitForSelector('div[data-testid="divProductWrapper"]', { timeout: 60000 });

        await page.evaluate(async () => {
            let lastHeight = document.body.scrollHeight;
            let scrollCount = 0;
            let scrollLimit = 10;

            while (scrollCount < scrollLimit) {
                window.scrollTo(0, document.body.scrollHeight);
                await new Promise(resolve => setTimeout(resolve, 3000));
                let newHeight = document.body.scrollHeight;
                if (newHeight === lastHeight) break;
                lastHeight = newHeight;
                scrollCount++;
            }
        });

        await page.waitForSelector('img.css-1c345mg', { timeout: 60000 });

        const products = await page.evaluate(() => {
            const placeholderImage = 'https://assets.tokopedia.net/assets-tokopedia-lite/v2/zeus/kratos/85cc883d.svg';
            const productElements = document.querySelectorAll('div[data-testid="divProductWrapper"]');
            const products = [];

            productElements.forEach((element) => {
                let name = element.querySelector('a')?.innerText || "No Name";
                let priceText = element.querySelector('span[class*="css-1k7y5tq"]')?.innerText || element.querySelector('span[class*="css-1ks6sb"]')?.innerText || "No Price";
                const image = element.querySelector('img')?.src || "No Image";
                let link = element.querySelector('a')?.href || "No Link";

                if (link && !link.startsWith('https://www.tokopedia.com')) {
                    link = 'https://www.tokopedia.com' + link;
                }

                const priceMatch = name.match(/Rp\d+(\.\d{3})*/);
                let price = "No Price";
                if (priceMatch && priceMatch[0]) {
                    price = priceMatch[0];
                    name = name.replace(priceMatch[0], '').trim();
                }

                if (image !== placeholderImage && name && price && link) {
                    products.push({ name, price, image, link });
                }
            });
            return products;
        });

        await browser.close();
        res.json(products);
    } catch (error) {
        console.error('Error scraping Tokopedia:', error.message);
        res.status(500).send(`Error scraping data: ${error.message}`);
    }
});

app.use(express.json());
app.post('/v1/chat/completions', async (req, res) => {
    try {
        const data = req.body;
        console.log(data);

        const OPENAI_API_KEY = process.env.OPENAI_API_KEY;  // Ensure to store your key securely in .env

        const response = await fetch('https://free.v36.cm/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: data.messages[0].content }]
            })
        });

        if (!response.ok) {
            const errorDetails = await response.text();
            console.error('Error details:', errorDetails);
            throw new Error('Network response was not ok');
        }

        const result = await response.json();
        res.json(result);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
