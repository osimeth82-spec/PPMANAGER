import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import multer from "multer";
import Database from "better-sqlite3";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Konfiguration des Speicherpfads
let storagePath = process.env.INVOICE_STORAGE_PATH || "Z:\\Simeth\\Paypal\\Rechnung";

// Sicherstellen, dass das Verzeichnis existiert
if (!fs.existsSync(storagePath)) {
  try {
    fs.mkdirSync(storagePath, { recursive: true });
    console.log(`Verzeichnis erstellt: ${storagePath}`);
  } catch (err) {
    console.error(`Fehler beim Erstellen des Verzeichnisses ${storagePath}. Nutze Fallback.`);
    storagePath = "./uploads/PAYPAL_RECHNUNG";
    if (!fs.existsSync(storagePath)) {
      fs.mkdirSync(storagePath, { recursive: true });
    }
  }
}

// Datenbank-Setup
const db = new Database("paypal_tracker.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item TEXT NOT NULL,
    amount REAL NOT NULL,
    order_number TEXT,
    invoice_filename TEXT,
    is_done INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Sicherstellen, dass die Spalte is_done existiert (für bestehende Datenbanken)
try {
  db.exec("ALTER TABLE purchases ADD COLUMN is_done INTEGER DEFAULT 0");
} catch (e) {
  // Spalte existiert wahrscheinlich schon
}

try {
  db.exec("ALTER TABLE purchases ADD COLUMN download_count INTEGER DEFAULT 0");
} catch (e) {
  // Spalte existiert wahrscheinlich schon
}

// Multer für Datei-Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, storagePath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});
const upload = multer({ storage });

app.use(express.json());

// API-Endpunkte
app.get("/api/purchases", (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM purchases ORDER BY created_at DESC").all();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Fehler beim Laden der Daten" });
  }
});

app.post("/api/purchases", upload.single("invoice"), (req, res) => {
  const { item, amount, order_number } = req.body;
  const invoice_filename = req.file ? req.file.filename : null;

  if (!item || !amount) {
    return res.status(400).json({ error: "Gegenstand und Betrag sind erforderlich" });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO purchases (item, amount, order_number, invoice_filename, is_done)
      VALUES (?, ?, ?, ?, 0)
    `);
    const result = stmt.run(item, amount, order_number, invoice_filename);
    res.json({ id: result.lastInsertRowid, item, amount, order_number, invoice_filename, is_done: 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Fehler beim Speichern der Daten" });
  }
});

app.patch("/api/purchases/:id", (req, res) => {
  const { id } = req.params;
  const { is_done } = req.body;

  try {
    const stmt = db.prepare("UPDATE purchases SET is_done = ? WHERE id = ?");
    stmt.run(is_done ? 1 : 0, id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Fehler beim Aktualisieren" });
  }
});

app.post("/api/purchases/:id/invoice", upload.single("invoice"), (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Ungültige ID" });
  }
  if (!req.file) {
    return res.status(400).json({ error: "Keine Datei hochgeladen" });
  }

  try {
    // 1. Alten Eintrag in der Datenbank suchen, um alte Datei zu löschen (falls vorhanden)
    const purchase = db.prepare("SELECT invoice_filename FROM purchases WHERE id = ?").get(id) as any;
    
    if (purchase && purchase.invoice_filename) {
      try {
        const filePath = path.join(storagePath, purchase.invoice_filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (fileError) {
        console.error("Fehler beim Löschen der alten physischen Datei:", fileError);
      }
    }

    // 2. Datenbank aktualisieren mit neuem Dateinamen
    const stmt = db.prepare("UPDATE purchases SET invoice_filename = ? WHERE id = ?");
    stmt.run(req.file.filename, id);
    res.json({ success: true, invoice_filename: req.file.filename });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Fehler beim Speichern der Rechnung" });
  }
});

app.get("/api/purchases/:id/download", (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Ungültige ID" });
  }

  try {
    const purchase = db.prepare("SELECT invoice_filename FROM purchases WHERE id = ?").get(id) as any;
    if (!purchase || !purchase.invoice_filename) {
      return res.status(404).json({ error: "Rechnung nicht gefunden" });
    }

    // Download-Counter inkrementieren
    db.prepare("UPDATE purchases SET download_count = download_count + 1 WHERE id = ?").run(id);

    const filePath = path.join(storagePath, purchase.invoice_filename);
    if (fs.existsSync(filePath)) {
      // Send file with correct content type and filename
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: "Datei auf dem Server nicht gefunden" });
    }
  } catch (error) {
    console.error("Fehler beim Herunterladen:", error);
    res.status(500).json({ error: "Datenbankfehler beim Herunterladen" });
  }
});

app.delete("/api/purchases/:id", (req, res) => {
  const id = parseInt(req.params.id);
  
  if (isNaN(id)) {
    return res.status(400).json({ error: "Ungültige ID" });
  }

  try {
    // 1. Eintrag in der Datenbank suchen
    const purchase = db.prepare("SELECT invoice_filename FROM purchases WHERE id = ?").get(id) as any;
    
    if (!purchase) {
      return res.status(404).json({ error: "Eintrag nicht gefunden" });
    }

    // 2. Datei löschen (optional, falls vorhanden)
    if (purchase.invoice_filename) {
      try {
        const filePath = path.join(storagePath, purchase.invoice_filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (fileError) {
        console.error("Fehler beim Löschen der physischen Datei:", fileError);
      }
    }

    // 3. Datenbankeintrag löschen
    const stmt = db.prepare("DELETE FROM purchases WHERE id = ?");
    const result = stmt.run(id);
    
    if (result.changes > 0) {
      res.json({ success: true });
    } else {
      res.status(400).json({ error: "Löschen fehlgeschlagen" });
    }
  } catch (error) {
    console.error("Kritischer Fehler im Delete-Endpunkt:", error);
    res.status(500).json({ error: "Datenbankfehler beim Löschen" });
  }
});

// Statische Dateien für Rechnungen (zum Anzeigen/Download)
app.use("/invoices", express.static(storagePath));

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        host: '0.0.0.0',
        port: 3000
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server läuft auf http://localhost:${PORT}`);
  });
}

startServer();
