import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("househunt.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL,
    type TEXT NOT NULL, -- 'rent' or 'sale'
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    bedrooms INTEGER,
    bathrooms INTEGER,
    sqft INTEGER,
    amenities TEXT, -- JSON string
    images TEXT, -- JSON string
    agent_name TEXT,
    agent_phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Seed data if empty
const count = db.prepare("SELECT COUNT(*) as count FROM properties").get() as { count: number };
if (count.count === 0) {
  const insert = db.prepare(`
    INSERT INTO properties (title, description, price, type, address, city, bedrooms, bathrooms, sqft, amenities, images, agent_name, agent_phone)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedProperties = [
    [
      "Modern Minimalist Villa",
      "A stunning modern villa with floor-to-ceiling windows and a private pool.",
      4500,
      "rent",
      "123 Azure Lane",
      "Los Angeles",
      3,
      3,
      2400,
      JSON.stringify(["Pool", "Gym", "Smart Home"]),
      JSON.stringify(["https://picsum.photos/seed/villa1/800/600", "https://picsum.photos/seed/villa2/800/600"]),
      "Sarah Jenkins",
      "+1 555-0101"
    ],
    [
      "Urban Loft in Downtown",
      "Industrial style loft with exposed brick and high ceilings.",
      850000,
      "sale",
      "456 Brick St",
      "New York",
      1,
      1,
      1100,
      JSON.stringify(["Elevator", "Rooftop Access"]),
      JSON.stringify(["https://picsum.photos/seed/loft1/800/600", "https://picsum.photos/seed/loft2/800/600"]),
      "Michael Chen",
      "+1 555-0202"
    ],
    [
      "Cozy Suburban Cottage",
      "Perfect family home with a large backyard and updated kitchen.",
      3200,
      "rent",
      "789 Maple Ave",
      "Austin",
      4,
      2,
      1800,
      JSON.stringify(["Garden", "Garage", "Pet Friendly"]),
      JSON.stringify(["https://picsum.photos/seed/cottage1/800/600"]),
      "Emily Rodriguez",
      "+1 555-0303"
    ]
  ];

  for (const p of seedProperties) {
    insert.run(...p);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/properties", (req, res) => {
    const { type, city, minPrice, maxPrice } = req.query;
    let query = "SELECT * FROM properties WHERE 1=1";
    const params: any[] = [];

    if (type) {
      query += " AND type = ?";
      params.push(type);
    }
    if (city) {
      query += " AND city LIKE ?";
      params.push(`%${city}%`);
    }
    if (minPrice) {
      query += " AND price >= ?";
      params.push(Number(minPrice));
    }
    if (maxPrice) {
      query += " AND price <= ?";
      params.push(Number(maxPrice));
    }

    query += " ORDER BY created_at DESC";
    
    const properties = db.prepare(query).all(...params);
    res.json(properties.map((p: any) => ({
      ...p,
      amenities: JSON.parse(p.amenities),
      images: JSON.parse(p.images)
    })));
  });

  app.get("/api/properties/:id", (req, res) => {
    const property = db.prepare("SELECT * FROM properties WHERE id = ?").get(req.params.id) as any;
    if (property) {
      res.json({
        ...property,
        amenities: JSON.parse(property.amenities),
        images: JSON.parse(property.images)
      });
    } else {
      res.status(404).json({ error: "Property not found" });
    }
  });

  app.post("/api/properties", (req, res) => {
    const { title, description, price, type, address, city, bedrooms, bathrooms, sqft, amenities, images, agent_name, agent_phone } = req.body;
    const insert = db.prepare(`
      INSERT INTO properties (title, description, price, type, address, city, bedrooms, bathrooms, sqft, amenities, images, agent_name, agent_phone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = insert.run(
      title,
      description,
      price,
      type,
      address,
      city,
      bedrooms,
      bathrooms,
      sqft,
      JSON.stringify(amenities || []),
      JSON.stringify(images || []),
      agent_name,
      agent_phone
    );
    res.json({ id: result.lastInsertRowid });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
