const express = require('express');
const fs = require('fs');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const PORT = 8080;

app.use(cors());
app.use(bodyParser.json());

app.use((req, res, next) => {
  next();
});

// Helpers
function readDB() {
  if (!fs.existsSync(DB_FILE)) return [];
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    if (!data.trim()) return [];
    return JSON.parse(data);
  } catch (e) {
    fs.writeFileSync(DB_FILE, '[]');
    return [];
  }
}
function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

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

// Helper to get file path for an institution
function getInstitutionFile(institutionId, file) {
  return path.join(__dirname, 'data', institutionId, file);
}

// ===== ROUTES =====

// Get all To Do items
app.get('/maintenance_requests', (req, res) => {
  res.json(readDB());
});

// Get all Done items
app.get('/maintenance_requests/completed', (req, res) => {
  res.json(readCompletedDB());
});

// Add new To Do item
app.post('/maintenance_requests', (req, res) => {
  const items = readDB();
  items.push(req.body);
  writeDB(items);
  res.status(201).json({ success: true });
});

// Replace all To Do items
app.put('/maintenance_requests', (req, res) => {
  writeDB(req.body);
  res.status(200).json({ success: true });
});

// Complete To Do items
app.post('/maintenance_requests/complete', (req, res) => {
  const { ids } = req.body;
  let items = readDB();
  let completed = readCompletedDB();
  const toComplete = items.filter(item => ids.includes(item.id));
  items = items.filter(item => !ids.includes(item.id));
  writeDB(items);
  writeCompletedDB([...completed, ...toComplete]);
  res.json({ success: true });
});

// Update To Do item by ID
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

// Delete To Do items
app.post('/maintenance_requests/delete', (req, res) => {
  const { ids } = req.body;
  let items = readDB();
  items = items.filter(item => !ids.includes(item.id));
  writeDB(items);
  res.json({ success: true });
});

// Delete Done items
app.post('/maintenance_requests/completed/delete', (req, res) => {
  const { ids } = req.body;
  let completed = readCompletedDB();
  completed = completed.filter(item => !ids.includes(item.id));
  writeCompletedDB(completed);
  res.json({ success: true });
});

// Get workers
app.get('/workers', (req, res) => {
  res.json(JSON.parse(fs.readFileSync('/workers.json', 'utf8')));
});
// Save workers
app.post('/workers', (req, res) => {
  fs.writeFileSync(WORKERS_FILE, JSON.stringify(req.body, null, 2));
  res.json({ success: true });
});

// Get cities
app.get('/cities', (req, res) => {
  res.json(JSON.parse(fs.readFileSync(CITIES_FILE, 'utf8')));
});
// Save cities
app.post('/cities', (req, res) => {
  fs.writeFileSync(CITIES_FILE, JSON.stringify(req.body, null, 2));
  res.json({ success: true });
});

// Login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const dataDir = path.join(__dirname, 'institutions');
  const institutions = fs.readdirSync(dataDir).filter(f => fs.statSync(path.join(dataDir, f)).isDirectory());

  let foundUser = null;
  let institutionId = null;

  for (const inst of institutions) {
    const workersFile = path.join(dataDir, inst, 'workers.json');
    if (!fs.existsSync(workersFile)) continue;
    const users = JSON.parse(fs.readFileSync(workersFile, 'utf8'));
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      foundUser = user;
      institutionId = inst;
      break;
    }
  }

  if (foundUser) {
    res.json({ 
      success: true, 
      name: foundUser.name, 
      role: foundUser.role,
      institutionId: institutionId // <-- the folder name
    });
  } else {
    res.status(401).json({ success: false, message: "Invalid credentials" });
  }
});

// Manage section for administrator
// Delete Worker
app.post('/workers/delete', (req, res) => {
  const { username } = req.body;
  const workers = JSON.parse(fs.readFileSync('workers.json'));
  const updated = workers.filter(w => w.username !== username);
  fs.writeFileSync('workers.json', JSON.stringify(updated, null, 2));
  res.json({ success: true });
});

app.post('/cities/delete', (req, res) => {
  const { cityName } = req.body;
  const cities = JSON.parse(fs.readFileSync('cities.json'));
  const updated = cities.filter(c => c.name !== cityName);
  fs.writeFileSync('cities.json', JSON.stringify(updated, null, 2));
  res.json({ success: true });
});

app.post('/cities/deleteStreet', (req, res) => {
  const { cityName, streetName } = req.body;
  const cities = JSON.parse(fs.readFileSync('cities.json'));
  const updated = cities.map(c =>
    c.name === cityName
      ? { ...c, streets: c.streets.filter(s => s !== streetName) }
      : c
  );
  fs.writeFileSync('cities.json', JSON.stringify(updated, null, 2));
  res.json({ success: true });
});

// Example: Get all To Do items for an institution
app.get('/institutions/:institutionId/maintenance_requests', (req, res) => {
  const file = getInstitutionFile(req.params.institutionId, 'maintenance_requests.json');
  if (!fs.existsSync(file)) return res.json([]);
  const data = fs.readFileSync(file, 'utf8');
  res.json(data.trim() ? JSON.parse(data) : []);
});

// Example: Add a To Do item for an institution
app.post('/institutions/:institutionId/maintenance_requests', (req, res) => {
  const file = getInstitutionFile(req.params.institutionId, 'maintenance_requests.json');
  let items = [];
  if (fs.existsSync(file)) {
    const data = fs.readFileSync(file, 'utf8');
    items = data.trim() ? JSON.parse(data) : [];
  }
  items.push(req.body);
  fs.writeFileSync(file, JSON.stringify(items, null, 2));
  res.status(201).json({ success: true });
});

// Repeat similar logic for workers, cities, completed_maintenance_requests, etc.

// Root
app.get("/", (req, res) => {
  res.send("Server is running!");
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
