require('dotenv').config();
const express = require('express');
const cors = require('cors');
const instanceManager = require('./instanceManager');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// API Endpoints
app.post('/api/instances', async (req, res) => {
    try {
        const instance = await instanceManager.createInstance(req.body);
        res.json(instance);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create instance' });
    }
});

app.get('/api/instances', (req, res) => {
    res.json(instanceManager.listInstances());
});

app.delete('/api/instances/:id', (req, res) => {
    const success = instanceManager.stopInstance(req.params.id);
    if (success) {
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Instance not found' });
    }
});

// Serve static files from client build
app.use(express.static(path.join(__dirname, '../client/dist')));

// Handle SPA routing
app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

const PORT = process.env.SERVER_PORT || 3000;
const HOST = '100.100.42.11';
app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
});
