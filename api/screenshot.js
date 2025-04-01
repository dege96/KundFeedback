const chromium = require('@sparticuz/chromium');
const puppeteerCore = require('puppeteer-core');

// Kontrollera om vi är i Vercel-miljö
const isVercel = process.env.VERCEL === '1';

// Lista över tillåtna domäner
const allowedDomains = [
    'spotifyslapped.netlify.app',
    'localhost',
    '127.0.0.1'
];

// Validera URL
function isValidUrl(url) {
    try {
        const parsedUrl = new URL(url);
        return allowedDomains.some(domain => parsedUrl.hostname.includes(domain));
    } catch (error) {
        return false;
    }
}

// Hitta Chrome-sökvägen baserat på operativsystem
function getChromePath() {
    if (process.platform === 'win32') {
        return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    } else if (process.platform === 'darwin') {
        return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    } else {
        return '/usr/bin/google-chrome';
    }
}

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
        if (!isValidUrl(url)) {
            throw new Error('URL is not in the allowed domains list');
        }
        if (typeof x !== 'number' || typeof y !== 'number') {
            throw new Error(`Invalid coordinates: x=${x}, y=${y}`);
        }

        console.log('Starting screenshot process for:', {
            url,
            coordinates: { x, y },
            timestamp: new Date().toISOString(),
            environment: isVercel ? 'Vercel' : 'Local'
        });

        // Konfigurera browser options
        const options = {
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage'
            ],
            executablePath: isVercel ? await chromium.executablePath() : getChromePath(),
            headless: 'new',
            defaultViewport: null,  // Låter viewport anpassa sig efter skärmstorleken
            ignoreHTTPSErrors: true
        };

        console.log('Launching browser with options:', {
            executablePath: options.executablePath,
            args: options.args
        });

        browser = await puppeteerCore.launch(options);
        page = await browser.newPage();

        // Sätt timeouts
        await page.setDefaultNavigationTimeout(60000);
        await page.setDefaultTimeout(60000);

        // Sätt user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

        // Aktivera JavaScript och cookies
        await page.setJavaScriptEnabled(true);
        await page.setCookie();

        // Sätt extra headers
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        });

        // Ladda sidan med retry-logik
        let retries = 3;
        while (retries > 0) {
            try {
                await page.goto(url, {
                    waitUntil: ['networkidle0', 'domcontentloaded', 'load'],
                    timeout: 60000
                });
                
                // Vänta på att sidan ska vara helt laddad
                await page.waitForFunction(() => {
                    return document.readyState === 'complete';
                }, { timeout: 10000 });
                
                break;
            } catch (error) {
                retries--;
                if (retries === 0) throw error;
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        // Hämta sidans faktiska dimensioner
        const dimensions = await page.evaluate(() => ({
            width: document.documentElement.clientWidth,
            height: document.documentElement.clientHeight
        }));

        console.log('Page dimensions:', dimensions);

        // Ta screenshot
        const screenshot = await page.screenshot({
            clip: {
                x: Math.max(0, x - 150),
                y: Math.max(0, y - 100),
                width: 300,
                height: 200
            },
            encoding: 'base64',
            type: 'png'
        });

        res.json({
            success: true,
            screenshot: `data:image/png;base64,${screenshot}`
        });

    } catch (error) {
        console.error('Screenshot error:', error);
        res.status(500).json({
            error: 'Screenshot failed',
            details: error.message,
            type: error.name,
            url: url
        });
    } finally {
        if (page) await page.close();
        if (browser) await browser.close();
    }
}

module.exports = screenshotHandler; 