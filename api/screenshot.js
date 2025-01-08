const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

// Skapa express app
const app = express();

// Middleware
app.use(express.static(__dirname));
app.use(bodyParser.json());

// Root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    next();
});

// Konfigurera e-posttransport
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'victordegeer96@gmail.com',
        pass: 'rqgp yvim omob evzn' 
    }
});

// API-endpoint för feedback
app.post('/api/feedback', async (req, res) => {
    const { elementInfo, message } = req.body;
    const websiteName = "Spotify Slapped";
    
    // Skapa en temporär fil för skärmdumpen
    let screenshotPath = null;
    
    try {
        if (elementInfo.screenshot && elementInfo.screenshot.startsWith('data:image/png;base64,')) {
            const base64Data = elementInfo.screenshot.split('base64,')[1];
            screenshotPath = path.join(__dirname, 'temp-screenshot.png');
            await fs.writeFile(screenshotPath, base64Data, 'base64');
            console.log('Screenshot saved to:', screenshotPath);
        }

        const mailOptions = {
            from: 'victordegeer96@gmail.com',
            to: 'victordegeer96@gmail.com',
            subject: `Ny feedback från ${websiteName}`,
            html: `
                <h2>Ny feedback från ${websiteName}</h2>
                <h3>Element information:</h3>
                <ul>
                    <li><strong>Beskrivning:</strong> ${elementInfo.elementDescription}</li>
                    <li><strong>URL:</strong> ${elementInfo.url}</li>
                    <li><strong>Tidpunkt:</strong> ${elementInfo.timestamp}</li>
                </ul>
                <h3>Meddelande:</h3>
                <p>${message}</p>
                ${screenshotPath ? '<h3>Skärmdump:</h3><img src="cid:screenshot">' : ''}
            `,
            attachments: screenshotPath ? [
                {
                    filename: 'screenshot.png',
                    path: screenshotPath,
                    cid: 'screenshot'
                }
            ] : []
        };

        await transporter.sendMail(mailOptions);
        console.log('Email sent successfully');

        // Ta bort temporär fil om den finns
        if (screenshotPath) {
            await fs.unlink(screenshotPath);
            console.log('Temporary screenshot file deleted');
        }

        res.status(200).json({ message: 'Feedback skickad!' });
    } catch (error) {
        console.error('Error:', error);
        
        // Försök ta bort temporär fil även vid fel
        if (screenshotPath) {
            try {
                await fs.unlink(screenshotPath);
                console.log('Temporary screenshot file deleted after error');
            } catch (unlinkError) {
                console.error('Error deleting temporary file:', unlinkError);
            }
        }
        
        res.status(500).json({ error: 'Kunde inte skicka feedback' });
    }
});

// Ny route för att hämta elementinformation
app.post('/get-element-info', async (req, res) => {
    const { x, y, url } = req.body;
    
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto(url);
        
        // Hämta element på positionen
        const elementInfo = await page.evaluate(({x, y}) => {
            const element = document.elementFromPoint(x, y);
            return {
                tagName: element.tagName,
                text: element.textContent,
                alt: element.getAttribute('alt'),
                title: element.getAttribute('title'),
                className: element.className
            };
        }, {x, y});
        
        await browser.close();
        res.json(elementInfo);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Kunde inte hämta elementinformation' });
    }
});

// Skapa en delad browser-instans som kan återanvändas
let browser;
(async () => {
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--window-size=1024,768'
            ],
            defaultViewport: {
                width: 1024,
                height: 768
            }
        });
        console.log('Browser instance created successfully');
    } catch (error) {
        console.error('Failed to create browser instance:', error);
    }
})();

// Ny endpoint för screenshots med tidtagning
app.post('/api/screenshot', async (req, res) => {
    const { url, x, y } = req.body;
    let page = null;
    
    console.log('Screenshot request received:', { url, x, y });
    
    try {
        if (!browser || !browser.isConnected()) {
            console.log('Creating new browser instance...');
            browser = await puppeteer.launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--window-size=1024,768'
                ],
                defaultViewport: {
                    width: 1024,
                    height: 768
                }
            });
        }

        page = await browser.newPage();
        console.log('New page created');

        await page.setViewport({
            width: 1024,
            height: 768,
            deviceScaleFactor: 1
        });

        await page.goto(url, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });
        console.log('Page loaded');

        // Ta screenshot direkt utan extra väntan
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

        await page.close();
        return res.json({ 
            screenshot: `data:image/png;base64,${screenshot}`,
            success: true
        });

    } catch (error) {
        console.error('Screenshot error:', error);
        if (page) await page.close();
        return res.status(500).json({
            error: 'Screenshot failed',
            details: error.message
        });
    }
});

// Lägg till en cleanup-funktion när servern stängs ner
process.on('SIGINT', async () => {
    if (browser) {
        await browser.close();
    }
    process.exit();
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server körs på port ${PORT}`);
}); 