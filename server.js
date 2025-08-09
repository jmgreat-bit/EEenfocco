const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Serve frontend files

// Airtable configuration
const AIRTABLE_CONFIG = {
    token: process.env.AIRTABLE_TOKEN,
    baseId: process.env.AIRTABLE_BASE_ID,
    tables: {
        waitlist: 'ENFOCO Waitlist',
        suggestions: 'User Suggestions & Ideas',
        partnerships: 'Partnership & Collaboration'
    }
};

// Generic function to send data to Airtable
async function sendToAirtable(tableName, fields) {
    const url = `https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/${tableName}`;
    
    try {
        const response = await axios.post(url, {
            records: [{ fields }]
        }, {
            headers: {
                'Authorization': `Bearer ${AIRTABLE_CONFIG.token}`,
                'Content-Type': 'application/json'
            }
        });

        return { success: true, data: response.data };
    } catch (error) {
        console.error('Airtable error:', error.response?.data || error.message);
        return { 
            success: false, 
            error: error.response?.data?.error || error.message 
        };
    }
}

// API Routes
app.post('/api/waitlist', async (req, res) => {
    const { fullName, email, industry, region, budget } = req.body;
    
    if (!fullName || !email || !industry || !region || !budget) {
        return res.status(400).json({ 
            error: 'Please fill in all required fields to join the waitlist' 
        });
    }

    const fields = {
        'Full Name': fullName,
        'Email Address': email,
        'Industry/Role': industry,
        'Primary Region of Interest': region,
        'Monthly Budget Range': budget,
        'Status': 'New'
    };

    const result = await sendToAirtable(AIRTABLE_CONFIG.tables.waitlist, fields);
    
    if (result.success) {
        res.json({ message: 'Successfully joined waitlist!' });
    } else {
        res.status(500).json({ error: 'Failed to join waitlist' });
    }
});

app.post('/api/suggestions', async (req, res) => {
    const { email, suggestion } = req.body;
    
    if (!email || !suggestion) {
        return res.status(400).json({ 
            error: 'Please fill in all required fields' 
        });
    }

    const fields = {
        'Email': email,
        'Detailed Suggestion': suggestion,
        'Suggestion Type': 'Feature Request',
        'Priority Level': 'Medium',
        'Status': 'New'
    };

    const result = await sendToAirtable(AIRTABLE_CONFIG.tables.suggestions, fields);
    
    if (result.success) {
        res.json({ message: 'Suggestion received!' });
    } else {
        res.status(500).json({ error: 'Failed to send suggestion' });
    }
});

app.post('/api/partnerships', async (req, res) => {
    const { email, details } = req.body;
    
    if (!email || !details) {
        return res.status(400).json({ 
            error: 'Please fill in all required fields' 
        });
    }

    const fields = {
        'Email': email,
        'Additional Details': details,
        'Contact Status': 'New'
    };

    const result = await sendToAirtable(AIRTABLE_CONFIG.tables.partnerships, fields);
    
    if (result.success) {
        res.json({ message: 'Partnership request received!' });
    } else {
        res.status(500).json({ error: 'Failed to send partnership request' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'Backend is running!' });
});

app.listen(PORT, () => {
    console.log(`🚀 ENFOCO Backend running on http://localhost:${PORT}`);

});
