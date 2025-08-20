const express = require('express');
const path = require('path');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
// Serve static files and images explicitly
app.use(express.static(__dirname));
app.use('/images', express.static(path.join(__dirname, 'images')));

// Optional: serve a basic favicon to avoid 404 noise
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'images', 'chin.png'));
});

app.get('/', (req, res) => {
 res.sendFile(__dirname + '/index.html');
});

// Serve posts page
app.get('/posts', (req, res) => {
  res.sendFile(path.join(__dirname, 'posts.html'));
});

// Simple JSON file storage for posts
const DATA_FILE = path.join(__dirname, 'posts.json');

function loadPosts() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify([]), 'utf8');
      return [];
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (error) {
    console.error('Failed to load posts:', error);
    return [];
  }
}

function savePosts(posts) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(posts, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Failed to save posts:', error);
    return false;
  }
}

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
       const response = await axios.post(
           url,
           {
               records: [{ fields }],
               typecast: true
           },
           {
               headers: {
                   Authorization: `Bearer ${AIRTABLE_CONFIG.token}`,
                   'Content-Type': 'application/json'
               }
           }
       );
       return { success: true, data: response.data };
   } catch (error) {
       const airtableError = error.response?.data || null;
       console.error('Airtable error:', airtableError || error.message);
       return {
           success: false,
           error: airtableError?.error || error.message,
           airtable: airtableError
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
       return res.json({ message: 'Successfully joined waitlist!' });
   }
   return res.status(500).json({ error: 'Failed to join waitlist', details: result.airtable || result.error });
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
       return res.json({ message: 'Suggestion received!' });
   }
   return res.status(500).json({ error: 'Failed to send suggestion', details: result.airtable || result.error });
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
       return res.json({ message: 'Partnership request received!' });
   }
   return res.status(500).json({ error: 'Failed to send partnership request', details: result.airtable || result.error });
});

// Posts API
app.get('/api/posts', (req, res) => {
   const posts = loadPosts().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
   res.json(posts);
});

app.post('/api/posts', (req, res) => {
   const { imageUrl, description, author } = req.body || {};
   if (!imageUrl || !description) {
       return res.status(400).json({ error: 'imageUrl and description are required' });
   }
   const posts = loadPosts();
   const newPost = {
       id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
       imageUrl,
       description,
       author: author && String(author).trim() ? String(author).trim() : 'Anonymous',
       createdAt: new Date().toISOString(),
       likes: 0,
       comments: []
   };
   posts.push(newPost);
   const ok = savePosts(posts);
   if (!ok) return res.status(500).json({ error: 'Failed to save post' });
   res.status(201).json(newPost);
});

app.post('/api/posts/:id/like', (req, res) => {
   const { id } = req.params;
   const posts = loadPosts();
   const idx = posts.findIndex(p => p.id === id);
   if (idx === -1) return res.status(404).json({ error: 'Post not found' });
   posts[idx].likes = (posts[idx].likes || 0) + 1;
   const ok = savePosts(posts);
   if (!ok) return res.status(500).json({ error: 'Failed to save like' });
   res.json({ likes: posts[idx].likes });
});

app.post('/api/posts/:id/comments', (req, res) => {
   const { id } = req.params;
   const { author, text } = req.body || {};
   if (!text) return res.status(400).json({ error: 'Comment text is required' });
   const posts = loadPosts();
   const idx = posts.findIndex(p => p.id === id);
   if (idx === -1) return res.status(404).json({ error: 'Post not found' });
   const comment = {
       id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
       author: author && String(author).trim() ? String(author).trim() : 'Anonymous',
       text: String(text).trim(),
       createdAt: new Date().toISOString()
   };
   posts[idx].comments = posts[idx].comments || [];
   posts[idx].comments.push(comment);
   const ok = savePosts(posts);
   if (!ok) return res.status(500).json({ error: 'Failed to save comment' });
   res.status(201).json(comment);
});

// Health check
app.get('/api/health', (req, res) => {
   res.json({ status: 'Backend is running!' });
});

app.listen(PORT, () => {
   console.log(`🚀 ENFOCO Backend running on http://localhost:${PORT}`);
});
