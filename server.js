const express = require('express');
const puppeteer = require('puppeteer');
const axios = require('axios');
const app = express();

// Dynamically set the port from environment variable or fallback to 3000
const port = process.env.PORT || 3000;
require('dotenv').config();  // Load environment variables from .env file

// Middleware for serving static files (public folder)
app.use(express.static('public'));

// Route for the main page (search page)
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/about.html');
});

// Route for scraping based on search query
app.get('/search', async (req, res) => {
    const keyword = req.query.keyword + " eco friendly";
    const url = `https://www.tokopedia.com/search?q=${encodeURIComponent(keyword)}&source=universe&st=product&srp_component_id=02.07.01.01`;

    try {
        // Launch Puppeteer in headless mode
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--disable-http2']  // Disable HTTP/2 for Puppeteer
        });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        // Wait for product elements to appear on the page
        await page.waitForSelector('div[data-testid="divProductWrapper"]', { timeout: 60000 });

        // Use scroll to load more products
        await page.evaluate(async () => {
            let lastHeight = document.body.scrollHeight;
            let scrollCount = 0;
            let scrollLimit = 10;  // Limit the scroll to avoid infinite scrolling

            while (scrollCount < scrollLimit) {
                window.scrollTo(0, document.body.scrollHeight);
                await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds for products to load
                let newHeight = document.body.scrollHeight;
                if (newHeight === lastHeight) break;  // Stop if no more products are loaded
                lastHeight = newHeight;
                scrollCount++;
            }
        });

        // Scrape product details
        const products = await page.evaluate(() => {
            const placeholderImage = 'https://assets.tokopedia.net/assets-tokopedia-lite/v2/zeus/kratos/85cc883d.svg'; // Placeholder image URL
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

                // Filter out products with placeholder images
                if (image !== placeholderImage && name && price && link) {
                    products.push({ name, price, image, link });
                }
            });
            return products;
        });

        // Close Puppeteer browser
        await browser.close();

        // Send the scraped products as a JSON response
        res.json(products);
    } catch (error) {
        console.error('Error scraping Tokopedia:', error.message);
        res.status(500).send(`Error scraping data: ${error.message}`);
    }
});

// Enable JSON parsing in request bodies
app.use(express.json());

// Example route for handling chat completions (replace with your specific API integration)
app.post('/v1/chat/completions', async (req, res) => {
    try {
        const data = req.body;
        console.log(data); // Log incoming request body

        // Example API key (replace with your actual API key)
        const OPENAI_API_KEY = 'your-api-key'; 

        // Request to the API for chat completions (replace with the actual endpoint)
        const response = await fetch('https://your-api-endpoint/v1/chat/completions', {
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
        res.json(result); // Send the result back to the client
    } catch (error) {
        console.error('Error:', error); // Log error
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start the server (use dynamic port for hosting platforms like Vercel/Netlify)
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
