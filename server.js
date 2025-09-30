const express = require('express');
const fs = require('fs');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer'); // <-- Added multer import
const app = express();

const PORT = 8081;

app.use(cors({
  origin: '*', // or list your app's origin explicitly
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

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
  console.log("attempt to get maintenance requests")
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
  console.log("attempt to log in")
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

// Assign workers to To Do items for an institution
app.post('/institutions/:institutionId/assign', (req, res) => {
  const { ids, workers } = req.body;
  const institutionId = req.params.institutionId;
  
  let items = readDB(institutionId);
  
  // Update each item's assignees
  items = items.map(item => {
    if (ids.includes(item.id)) {
      return { 
        ...item, 
        assignees: Array.isArray(item.assignees) 
          ? [...new Set([...item.assignees, ...workers])] // Merge and remove duplicates
          : workers // If assignees doesn't exist, set to workers
      };
    }
    return item;
  });
  
  writeDB(institutionId, items);
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

// Update a specific To Do item for an institution
app.put('/institutions/:institutionId/todo/:itemId', (req, res) => {
  const { itemId } = req.params;
  const institutionId = req.params.institutionId;
  const updatedItem = req.body;
  
  console.log(`Updating item ${itemId} for institution ${institutionId}`);
  
  let items = readDB(institutionId);
  const itemIndex = items.findIndex(item => item.id === itemId);
  
  if (itemIndex === -1) {
    return res.status(404).json({ success: false, message: "Item not found" });
  }
  
  // Update the item while preserving the original ID
  items[itemIndex] = { ...updatedItem, id: itemId };
  
  writeDB(institutionId, items);
  
  console.log(`Successfully updated item ${itemId}`);
  res.json({ success: true, item: items[itemIndex] });
});

// Update a specific Done item for an institution
app.put('/institutions/:institutionId/completed/:itemId', (req, res) => {
  const { itemId } = req.params;
  const institutionId = req.params.institutionId;
  const updatedItem = req.body;
  
  console.log(`Updating completed item ${itemId} for institution ${institutionId}`);
  
  let completed = readCompletedDB(institutionId);
  const itemIndex = completed.findIndex(item => item.id === itemId);
  
  if (itemIndex === -1) {
    return res.status(404).json({ success: false, message: "Completed item not found" });
  }
  
  // Update the item while preserving the original ID
  completed[itemIndex] = { ...updatedItem, id: itemId };
  
  writeCompletedDB(institutionId, completed);
  
  console.log(`Successfully updated completed item ${itemId}`);
  res.json({ success: true, item: completed[itemIndex] });
});

app.get('/institutions/test', (req, res) => {
  res.json({ ok: true, message: "Proxy route works!" });
});

// Reopen Done items for an institution (move back to To Do)
app.post('/institutions/:institutionId/completed_maintenance_requests/reopen', (req, res) => {
  const { ids } = req.body;
  const institutionId = req.params.institutionId;
  
  console.log(`Reopening items ${ids} for institution ${institutionId}`); // Add debug log

  let items = readDB(institutionId);
  let completed = readCompletedDB(institutionId);

  const toReopen = completed.filter(item => ids.includes(item.id));
  completed = completed.filter(item => !ids.includes(item.id));

  writeDB(institutionId, [...items, ...toReopen]);
  writeCompletedDB(institutionId, completed);

  console.log(`Successfully reopened ${toReopen.length} items`); // Add debug log

  res.json({ success: true });
});

// Root
app.get("/", (req, res) => {
  res.send("Server is running!");
});

// Listen on HTTP port 3000 only on localhost
app.listen(PORT, '127.0.0.1', () => {
  console.log(`HTTP Server running on http://127.0.0.1:${PORT}`);
});

// Create media directories and configure multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const institutionId = req.body.institutionId || req.params.institutionId;
    const mediaDir = path.join(__dirname, 'institutions', institutionId, 'media');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(mediaDir)) {
      fs.mkdirSync(mediaDir, { recursive: true });
    }
    
    cb(null, mediaDir);
  },
  filename: function (req, file, cb) {
    const itemId = req.body.itemId || 'item';
    const timestamp = Date.now();
    const extension = path.extname(file.originalname);
    cb(null, `${itemId}_${timestamp}${extension}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  }
});

// Add this route EXACTLY as written
app.post('/institutions/:institutionId/upload-media', upload.single('media'), (req, res) => {
  try {
    console.log('Upload request received for institution:', req.params.institutionId);
    console.log('File:', req.file);
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const institutionId = req.params.institutionId;
    const filename = req.file.filename;
    const mediaUrl = `https://api.anthonyarseneau.ca/institutions/${institutionId}/media/${filename}`;
    
    console.log(`Media uploaded successfully: ${filename}`);
    
    res.json({ 
      success: true, 
      mediaUrl: mediaUrl,
      filename: filename
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Add route to serve the uploaded files
app.get('/institutions/:institutionId/media/:filename', (req, res) => {
  const { institutionId, filename } = req.params;
  const filePath = path.join(__dirname, 'institutions', institutionId, 'media', filename);
  
  console.log('Serving file:', filePath);
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// Update the delete route to be more robust
app.delete('/institutions/:institutionId/media/:filename', (req, res) => {
  try {
    const { institutionId, filename } = req.params;
    const filePath = path.join(__dirname, 'institutions', institutionId, 'media', filename);
    
    console.log(`Delete request for: ${filePath}`);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Successfully deleted media file: ${filename}`);
      res.json({ success: true, message: 'File deleted successfully' });
    } else {
      console.log(`File not found (may already be deleted): ${filename}`);
      // Return success even if file doesn't exist (idempotent operation)
      res.json({ success: true, message: 'File not found (may already be deleted)' });
    }
  } catch (error) {
    console.error('Error deleting media file:', error);
    
    // Check if it's a "file not found" error
    if (error.code === 'ENOENT') {
      res.json({ success: true, message: 'File not found (may already be deleted)' });
    } else {
      res.status(500).json({ error: 'Failed to delete file' });
    }
  }
});