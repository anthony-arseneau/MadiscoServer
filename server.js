const express = require('express');
const https = require('https');
const fs = require('fs');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();

// HTTPS configuration
const options = {
  key: fs.readFileSync('/etc/letsencrypt/live/anthonyarseneau.ca/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/anthonyarseneau.ca/fullchain.pem')
};

const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(bodyParser.json());

app.use((req, res, next) => {
  next();
});

// Institution-aware helpers
function readDB(institutionId) {
  console.log('request to see maintenance requests from' + institutionId);
  const file = getInstitutionFile(institutionId, 'maintenance_requests.json');
  if (!fs.existsSync(file)) return [];
  try {
    const data = fs.readFileSync(file, 'utf8');
    if (!data.trim()) return [];
    return JSON.parse(data);
  } catch (e) {
    fs.writeFileSync(file, '[]');
    return [];
  }
}
function writeDB(institutionId, data) {
  const file = getInstitutionFile(institutionId, 'maintenance_requests.json');
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function readCompletedDB(institutionId) {
  const file = getInstitutionFile(institutionId, 'completed_maintenance_requests.json');
  if (!fs.existsSync(file)) return [];
  try {
    const data = fs.readFileSync(file, 'utf8');
    if (!data.trim()) return [];
    return JSON.parse(data);
  } catch (e) {
    fs.writeFileSync(file, '[]');
    return [];
  }
}
function writeCompletedDB(institutionId, data) {
  const file = getInstitutionFile(institutionId, 'completed_maintenance_requests.json');
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Helper to get file path for an institution
function getInstitutionFile(institutionId, file) {
  return path.join(__dirname, 'institutions', institutionId, file);
}

// ===== ROUTES =====

// Get all To Do items for an institution
app.get('/institutions/:institutionId/maintenance_requests', (req, res) => {
  const file = getInstitutionFile(req.params.institutionId, 'maintenance_requests.json');
  if (!fs.existsSync(file)) return res.json([]);
  const data = fs.readFileSync(file, 'utf8');
  res.json(data.trim() ? JSON.parse(data) : []);
});

// Add a To Do item for an institution
app.post('/institutions/:institutionId/maintenance_requests', (req, res) => {
  console.log('yo')
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

// Get all Done items for an institution
app.get('/institutions/:institutionId/completed_maintenance_requests', (req, res) => {
  const file = getInstitutionFile(req.params.institutionId, 'completed_maintenance_requests.json');
  if (!fs.existsSync(file)) return res.json([]);
  const data = fs.readFileSync(file, 'utf8');
  res.json(data.trim() ? JSON.parse(data) : []);
});


// Replace all To Do items
// app.put('/maintenance_requests', (req, res) => {
//   writeDB(req.body);
//   res.status(200).json({ success: true });
// });

// Complete To Do items for an institution
app.post('/institutions/:institutionId/complete', (req, res) => {
  const { ids } = req.body;
  const institutionId = req.params.institutionId;

  let items = readDB(institutionId);
  let completed = readCompletedDB(institutionId);

  const toComplete = items.filter(item => ids.includes(item.id));
  items = items.filter(item => !ids.includes(item.id));

  writeDB(institutionId, items);
  writeCompletedDB(institutionId, [...completed, ...toComplete]);

  res.json({ success: true });
});


app.post('/institutions/:institutionId/maintenance_requests/update', (req, res) => {
  const { id, updatedItem } = req.body;
  const institutionId = req.params.institutionId;
  let items = readDB(institutionId);
  const idx = items.findIndex(item => item.id === id);
  if (idx !== -1) {
    items[idx] = { ...items[idx], ...updatedItem };
    writeDB(institutionId, items);
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false, message: "Invalid id" });
  }
});

// Delete To Do items for an institution
app.post('/institutions/:institutionId/delete', (req, res) => {
  const { ids } = req.body;
  const institutionId = req.params.institutionId;
  let items = readDB(institutionId);
  items = items.filter(item => !ids.includes(item.id));
  writeDB(institutionId, items);
  res.json({ success: true });
});

// Delete Done items for an institution
app.post('/institutions/:institutionId/completed_maintenance_requests/delete', (req, res) => {
  const { ids } = req.body;
  const institutionId = req.params.institutionId;
  let completed = readCompletedDB(institutionId);
  completed = completed.filter(item => !ids.includes(item.id));
  writeCompletedDB(institutionId, completed);
  res.json({ success: true });
});

// Get workers for an institution
app.get('/institutions/:institutionId/workers', (req, res) => {
  const file = getInstitutionFile(req.params.institutionId, 'workers.json');
  if (!fs.existsSync(file)) return res.json([]);
  const data = fs.readFileSync(file, 'utf8');
  res.json(data.trim() ? JSON.parse(data) : []);
});
// Save workers for an institution
app.post('/institutions/:institutionId/workers', (req, res) => {
  const file = getInstitutionFile(req.params.institutionId, 'workers.json');
  fs.writeFileSync(file, JSON.stringify(req.body, null, 2));
  res.json({ success: true });
});

// Get cities for an institution
app.get('/institutions/:institutionId/cities', (req, res) => {
  const file = getInstitutionFile(req.params.institutionId, 'cities.json');
  if (!fs.existsSync(file)) return res.json([]);
  const data = fs.readFileSync(file, 'utf8');
  res.json(data.trim() ? JSON.parse(data) : []);
});
// Save cities for an institution
app.post('/institutions/:institutionId/cities', (req, res) => {
  const file = getInstitutionFile(req.params.institutionId, 'cities.json');
  fs.writeFileSync(file, JSON.stringify(req.body, null, 2));
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
// Delete Worker for an institution
app.post('/institutions/:institutionId/workers/delete', (req, res) => {
  const { username } = req.body;
  const institutionId = req.params.institutionId;
  const file = getInstitutionFile(institutionId, 'workers.json');
  let workers = [];
  if (fs.existsSync(file)) {
    workers = JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  const updated = workers.filter(w => w.username !== username);
  fs.writeFileSync(file, JSON.stringify(updated, null, 2));
  res.json({ success: true });
});

// Delete City for an institution
app.post('/institutions/:institutionId/cities/delete', (req, res) => {
  const { cityName } = req.body;
  const institutionId = req.params.institutionId;
  const file = getInstitutionFile(institutionId, 'cities.json');
  let cities = [];
  if (fs.existsSync(file)) {
    cities = JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  const updated = cities.filter(c => c.name !== cityName);
  fs.writeFileSync(file, JSON.stringify(updated, null, 2));
  res.json({ success: true });
});

// Delete Street from City for an institution
app.post('/institutions/:institutionId/cities/deleteStreet', (req, res) => {
  const { cityName, streetName } = req.body;
  const institutionId = req.params.institutionId;
  const file = getInstitutionFile(institutionId, 'cities.json');
  let cities = [];
  if (fs.existsSync(file)) {
    cities = JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  const updated = cities.map(c =>
    c.name === cityName
      ? { ...c, streets: c.streets.filter(s => s !== streetName) }
      : c
  );
  fs.writeFileSync(file, JSON.stringify(updated, null, 2));
  res.json({ success: true });
});

app.get('/institutions/test', (req, res) => {
  res.json({ ok: true, message: "Proxy route works!" });
});

// Root
app.get("/", (req, res) => {
  res.send("Server is running!");
});

https.createServer(options, app).listen(PORT, '0.0.0.0', () => {
  console.log(`HTTPS Server running on https://0.0.0.0:${PORT}`);
});

// app.listen(PORT, '0.0.0.0', () => {
//   console.log(`Server running on http://0.0.0.0:${PORT}`);
// });