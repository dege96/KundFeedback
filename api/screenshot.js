const puppeteer = require('puppeteer');

async function screenshotHandler(req, res) {
    // Hantera CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept');

    // Hantera OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Kontrollera att det är en POST request
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { url, x, y } = req.body;
    let browser = null;
    let page = null;

    try {
        // Validera input
        if (!url) {
            throw new Error('URL is required');
        }
        if (typeof x !== 'number' || typeof y !== 'number') {
            throw new Error(`Invalid coordinates: x=${x}, y=${y}`);
        }

        console.log('Starting screenshot process for:', {
            url,
            coordinates: { x, y },
            timestamp: new Date().toISOString()
        });
        
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage'
            ]
        });

        page = await browser.newPage();
        console.log('Browser page created');

        await page.setViewport({
            width: 1024,
            height: 768,
            deviceScaleFactor: 1,
        });

        // Sätt timeout för navigation
        await Promise.race([
            page.goto(url, {
                waitUntil: 'networkidle0',
                timeout: 30000
            }),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Navigation timeout')), 31000)
            )
        ]);

        console.log('Page loaded, taking screenshot');

        const screenshot = await page.screenshot({
            clip: {
                x: Math.max(0, x - 250),
                y: Math.max(0, y - 100),
                width: 300,
                height: 200
            },
            encoding: 'base64',
            type: 'png'
        });

        console.log('Screenshot taken successfully');

        return res.json({ 
            screenshot: `data:image/png;base64,${screenshot}`,
            success: true 
        });

    } catch (error) {
        console.error('Screenshot error:', {
            message: error.message,
            url,
            coordinates: { x, y },
            stack: error.stack
        });

        return res.status(500).json({
            error: 'Screenshot failed',
            details: error.message,
            type: error.name,
            url: url
        });

    } finally {
        if (page) await page.close().catch(console.error);
        if (browser) await browser.close().catch(console.error);
        console.log('Cleanup completed');
    }
}

module.exports = screenshotHandler; 