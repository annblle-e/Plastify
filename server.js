const express = require('express');
const puppeteer = require('puppeteer');
const axios = require('axios');
const fetch = require('node-fetch');  // Ensure fetch is available
const app = express();
const port = process.env.PORT || 3000; // Use the Vercel environment variable for port
require('dotenv').config();  // At the top of your server.js file

// Middleware untuk melayani file statis
app.use(express.static('public'));

// Route untuk halaman utama (search page)
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/about.html');
});

// Route untuk melakukan scraping berdasarkan query search
app.get('/search', async (req, res) => {
    const keyword = req.query.keyword + " eco friendly";
    const url = `https://www.tokopedia.com/search?q=${encodeURIComponent(keyword)}&source=universe&st=product&srp_component_id=02.07.01.01`;

    try {
        // Launch Puppeteer browser
        console.log("Launching Puppeteer...");
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--disable-http2']  // Disable HTTP/2
        });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        // Wait for product elements to appear
        await page.waitForSelector('div[data-testid="divProductWrapper"]', { timeout: 60000 });

        // Scroll to load more products
        await page.evaluate(async () => {
            let lastHeight = document.body.scrollHeight;
            let scrollCount = 0;
            let scrollLimit = 10;  // Limit scroll to 10 times

            while (scrollCount < scrollLimit) {
                window.scrollTo(0, document.body.scrollHeight);
                await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds to load more products
                let newHeight = document.body.scrollHeight;
                if (newHeight === lastHeight) break;  // Stop scrolling if no more content
                lastHeight = newHeight;
                scrollCount++;
            }
        });

        // Wait for product images to load
        await page.waitForSelector('img.css-1c345mg', { timeout: 60000 });

        // Extract product data
        const products = await page.evaluate(() => {
            const placeholderImage = 'https://assets.tokopedia.net/assets-tokopedia-lite/v2/zeus/kratos/85cc883d.svg'; // Placeholder image to avoid
            const productElements = document.querySelectorAll('div[data-testid="divProductWrapper"]');
            const products = [];

            productElements.forEach((element) => {
                let name = element.querySelector('a')?.innerText || "No Name";
                let priceText = element.querySelector('span[class*="css-1k7y5tq"]')?.innerText || element.querySelector('span[class*="css-1ks6sb"]')?.innerText || "No Price"; // Price from different elements
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

                // Filter out placeholder images and invalid data
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
        console.log(data); // Log incoming request body

        // Replace this with your actual API key from OpenAI
        const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-Sn8epIaPtpPVIXzt8d1071A99eBc4c5aB73d9e3e9dD78218';  // Ensure to use your .env for the key

        // Process the request with the new API endpoint
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
            const errorDetails = await response.text(); // Capture detailed error
            console.error('Error details:', errorDetails);
            throw new Error('Network response was not ok');
        }

        const result = await response.json();
        res.json(result); // Send back the response
    } catch (error) {
        console.error('Error:', error); // Log the error
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
