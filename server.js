const express = require('express');
const puppeteer = require('puppeteer');

const app = express();

// Enable 50MB payload limit to handle large Base64 images easily
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

let browser;

async function getBrowser() {
  if (!browser || !browser.isConnected()) {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process'
      ]
    });
  }
  return browser;
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Render endpoint
app.post('/render', async (req, res) => {
  let page;
  try {
    const { html, width = 1440, height = 1800 } = req.body;

    if (!html) {
      return res.status(400).json({ error: 'Missing html string in request body' });
    }

    const b = await getBrowser();
    page = await b.newPage();

    await page.setViewport({
      width: parseInt(width, 10),
      height: parseInt(height, 10),
      deviceScaleFactor: 1
    });

    // Load HTML and wait for network/fonts to settle
    await page.setContent(html, {
      waitUntil: ['load', 'networkidle0'],
      timeout: 45000
    });

    // Ensure all custom web fonts (Lemon Milk) are fully loaded
    await page.evaluate(async () => {
      if (document.fonts) {
        await document.fonts.ready;
      }
    });

    const screenshotBuffer = await page.screenshot({
      type: 'png',
      omitBackground: false
    });

    res.set('Content-Type', 'image/png');
    res.send(screenshotBuffer);
  } catch (error) {
    console.error('Render error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Puppeteer HTML-to-Image renderer running on port ${PORT}`);
});
