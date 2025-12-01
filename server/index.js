require('dotenv').config();
const express = require('express');
const cors = require('cors');
const instanceManager = require('./instanceManager');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// API Endpoints
app.post('/api/instances', (req, res) => {
    try {
        const instance = instanceManager.createInstance();
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

// Serve static files from client build (later)
// app.use(express.static(path.join(__dirname, '../client/dist')));

const PORT = process.env.SERVER_PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
