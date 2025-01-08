const express = require('express');
const router = express.Router();

// Importera handlers
const screenshotHandler = require('./screenshot');
const feedbackHandler = require('./feedback');

// Debug middleware
router.use((req, res, next) => {
    console.log('API Request:', {
        method: req.method,
        path: req.path,
        body: req.body,
        timestamp: new Date().toISOString()
    });
    next();
});

// Definiera routes
router.post('/screenshot', screenshotHandler);
router.post('/feedback', feedbackHandler);

module.exports = router; 