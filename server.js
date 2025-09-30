const express = require('express');
const fs = require('fs');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const { promisify } = require('util');
const app = express();

const PORT = 8081;

// Promisify fs methods
const fsMkdir = promisify(fs.mkdir);
const fsReaddir = promisify(fs.readdir);
const fsUnlink = promisify(fs.unlink);
const fsStat = promisify(fs.stat);

// Middleware
app.use(cors({
  origin: '*', // or list your app's origin explicitly
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(bodyParser.json());
app.use(express.json());

// Serve static files (uploaded images)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const { institutionId } = req.body;
    const uploadPath = path.join(__dirname, 'uploads', institutionId);
    
    // Create directory if it doesn't exist
    try {
      await fsMkdir(uploadPath, { recursive: true });
    } catch (error) {
      console.error('Error creating upload directory:', error);
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const { itemId } = req.body;
    const timestamp = Date.now();
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${itemId}_${timestamp}${ext}`);
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images and videos
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'));
    }
  }
});

// Image upload endpoint
app.post('/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { institutionId } = req.body;
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${institutionId}/${req.file.filename}`;
    
    res.json({ imageUrl });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Image delete endpoint
app.delete('/delete-image', async (req, res) => {
  try {
    const { institutionId, imageUrl } = req.body;
    
    // Extract filename from URL
    const urlParts = imageUrl.split('/');
    const filename = urlParts[urlParts.length - 1];
    const filePath = path.join(__dirname, 'uploads', institutionId, filename);
    
    // Delete the file
    try {
      await fsUnlink(filePath);
      console.log(`Deleted image: ${filePath}`);
    } catch (error) {
      console.log(`Image not found or already deleted: ${filePath}`);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// Helper function to clean up orphaned images
const cleanupOrphanedImages = async (institutionId) => {
  try {
    const uploadPath = path.join(__dirname, 'uploads', institutionId);
    const dataPath = path.join(__dirname, 'data', institutionId);
    
    // Read all image files
    let imageFiles = [];
    try {
      imageFiles = await fsReaddir(uploadPath);
    } catch (error) {
      return; // No upload directory exists
    }
    
    // Read all todo and done items to find used images
    const usedImages = new Set();
    
    try {
      const todoData = await fs.readFile(path.join(dataPath, 'maintenance_requests.json'), 'utf8');
      const todoItems = JSON.parse(todoData);
      todoItems.forEach(item => {
        if (item.mediaUris) {
          item.mediaUris.forEach(url => {
            const filename = url.split('/').pop();
            if (filename) usedImages.add(filename);
          });
        }
      });
    } catch (error) {
      // No todo file exists
    }
    
    try {
      const doneData = await fs.readFile(path.join(dataPath, 'maintenance_requests_done.json'), 'utf8');
      const doneItems = JSON.parse(doneData);
      doneItems.forEach(item => {
        if (item.mediaUris) {
          item.mediaUris.forEach(url => {
            const filename = url.split('/').pop();
            if (filename) usedImages.add(filename);
          });
        }
      });
    } catch (error) {
      // No done file exists
    }
    
    // Delete orphaned images
    for (const imageFile of imageFiles) {
      if (!usedImages.has(imageFile)) {
        const filePath = path.join(uploadPath, imageFile);
        try {
          await fsUnlink(filePath);
          console.log(`Cleaned up orphaned image: ${imageFile}`);
        } catch (error) {
          console.error(`Error deleting orphaned image ${imageFile}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error during image cleanup:', error);
  }
};

// Run cleanup every hour
setInterval(() => {
  // Get all institution IDs and clean up their images
  fs.readdir(path.join(__dirname, 'data'))
    .then(institutions => {
      institutions.forEach(institutionId => {
        if (institutionId !== '.DS_Store') { // Skip system files
          cleanupOrphanedImages(institutionId);
        }
      });
    })
    .catch(error => {
      console.error('Error during scheduled cleanup:', error);
    });
}, 60 * 60 * 1000); // Every hour

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

// Make sure to create uploads directory on startup
const initializeUploadsDirectory = async () => {
  try {
    await fsMkdir(path.join(__dirname, 'uploads'), { recursive: true });
    console.log('Uploads directory initialized');
  } catch (error) {
    console.error('Error creating uploads directory:', error);
  }
};

// Start server
const startServer = async () => {
  await initializeUploadsDirectory();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer().catch(error => {
  console.error('Error starting server:', error);
});