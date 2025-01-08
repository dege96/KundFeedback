const nodemailer = require('nodemailer');

async function feedbackHandler(req, res) {
    // Hantera CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Validera input
        if (!req.body.elementInfo || !req.body.message) {
            throw new Error('Missing required fields');
        }

        const { elementInfo, message } = req.body;
        const websiteName = elementInfo.url ? new URL(elementInfo.url).hostname : "Unknown Website";

        console.log('Processing feedback for:', websiteName);

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        // Verifiera SMTP-anslutning
        await transporter.verify();
        console.log('SMTP connection verified');

        const mailResult = await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER,
            subject: `Ny feedback från ${websiteName}`,
            html: `
                <h2>Ny feedback från ${websiteName}</h2>
                <h3>Element information:</h3>
                <ul>
                    <li><strong>Beskrivning:</strong> ${elementInfo.elementDescription || 'Ingen beskrivning'}</li>
                    <li><strong>URL:</strong> ${elementInfo.url}</li>
                    <li><strong>Tidpunkt:</strong> ${elementInfo.timestamp}</li>
                </ul>
                <h3>Meddelande:</h3>
                <p>${message}</p>
                ${elementInfo.screenshot ? '<h3>Skärmdump:</h3><img src="cid:screenshot">' : ''}
            `,
            attachments: elementInfo.screenshot ? [{
                filename: 'screenshot.png',
                content: elementInfo.screenshot.split('base64,')[1],
                encoding: 'base64',
                cid: 'screenshot'
            }] : []
        });

        console.log('Email sent successfully:', mailResult.messageId);
        return res.json({ 
            message: 'Feedback skickad!',
            messageId: mailResult.messageId
        });

    } catch (error) {
        console.error('Feedback error:', {
            message: error.message,
            stack: error.stack,
            type: error.name
        });

        return res.status(500).json({
            error: 'Kunde inte skicka feedback',
            details: error.message,
            type: error.name
        });
    }
}

module.exports = feedbackHandler; 