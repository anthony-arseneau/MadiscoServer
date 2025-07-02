const express = require('express');
const fs = require('fs');
const cors = require('cors');
const bodyParser = require('body-parser');
const app = express();
const PORT = 4000;
const DB_FILE = './maintenance_requests.json';
const COMPLETED_DB_FILE = './completed_maintenance_requests.json';

app.use(cors());
app.use(bodyParser.json());

// Helper to read/write JSON file
function readDB() {
  if (!fs.existsSync(DB_FILE)) return [];
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    if (!data.trim()) return [];
    return JSON.parse(data);
  } catch (e) {
    // If JSON is invalid, reset file and return empty array
    fs.writeFileSync(DB_FILE, '[]');
    return [];
  }
}
function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Helper for completed DB
function readCompletedDB() {
  if (!fs.existsSync(COMPLETED_DB_FILE)) return [];
  try {
    const data = fs.readFileSync(COMPLETED_DB_FILE, 'utf8');
    if (!data.trim()) return [];
    return JSON.parse(data);
  } catch (e) {
    fs.writeFileSync(COMPLETED_DB_FILE, '[]');
    return [];
  }
}
function writeCompletedDB(data) {
  fs.writeFileSync(COMPLETED_DB_FILE, JSON.stringify(data, null, 2));
}

// Get all todo items
app.get('/maintenance_requests', (req, res) => {
  res.json(readDB());
});

// Add a new todo item
app.post('/maintenance_requests', (req, res) => {
  const items = readDB();
  items.push(req.body);
  writeDB(items);
  res.status(201).json({ success: true });
});

// Replace all todo items (for sync)
app.put('/maintenance_requests', (req, res) => {
  writeDB(req.body);
  res.status(200).json({ success: true });
});

// Complete items by id (move to completed DB)
app.post('/maintenance_requests/complete', (req, res) => {
  const { ids } = req.body; // array of ids
  let items = readDB();
  let completed = readCompletedDB();

  // Find items to complete
  const toComplete = items.filter(item => ids.includes(item.id));
  // Remove completed items from main list
  items = items.filter(item => !ids.includes(item.id));
  // Add to completed DB
  writeDB(items);
  writeCompletedDB([...completed, ...toComplete]);
  res.json({ success: true });
});

// Update a todo item by index
app.post('/maintenance_requests/update', (req, res) => {
  const { id, updatedItem } = req.body;
  let items = readDB();
  const idx = items.findIndex(item => item.id === id);
  if (idx !== -1) {
    items[idx] = { ...items[idx], ...updatedItem };
    writeDB(items);
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false, message: "Invalid id" });
  }
});

// Delete items by id
app.post('/maintenance_requests/delete', (req, res) => {
  const { ids } = req.body;
  let items = readDB();
  // Remove items whose id is in the ids array
  items = items.filter(item => !ids.includes(item.id));
  writeDB(items);
  res.json({ success: true });
});

// Login endpoint
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const users = JSON.parse(fs.readFileSync('./workerUsers.json', 'utf8'));
  const user = users.find(u => u.username === username && u.password === password);
  if (user) {
    res.json({ success: true, name: user.name, position: user.position });
  } else {
    res.status(401).json({ success: false, message: "Invalid credentials" });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});