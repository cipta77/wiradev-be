import express, { Request, Response } from "express";
import dotenv from "dotenv";
import { pool } from "./db/connection";
import userRoutes from "./routes/user.routes";
import authRoutes from "./routes/auth.routes";
import path from "path";
import fs from "fs";
import webMvpRoutes from "./routes/webMvp.routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Custom Cookie Parser Middleware
app.use((req, res, next) => {
  const cookies: { [key: string]: string } = {};
  const rawCookie = req.headers.cookie;
  if (rawCookie) {
    rawCookie.split(";").forEach((cookie) => {
      const parts = cookie.split("=");
      const key = parts.shift()?.trim();
      const val = parts.join("=");
      if (key) {
        cookies[key] = decodeURIComponent(val);
      }
    });
  }
  // Attach parsed cookies to Request object
  (req as any).cookies = cookies;
  next();
});

// Enable CORS supporting credentials and dynamic origin
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.get("/", (req: Request, res: Response): void => {
  res.status(200).json({
    message: "Welcome to the Hi-Fi Express Backend API 🚀",
    status: "Healthy",
    timestamp: new Date().toISOString(),
    endpoints: {
      health: "/health",
      auth: "/api/auth",
      users: "/api/users"
    }
  });
});

app.get("/health", async (req: Request, res: Response): Promise<void> => {
  const healthStatus = {
    status: "UP",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      server: "UP",
      database: "DOWN",
    },
    error: null as string | null,
  };

  try {
    await pool.query("SELECT 1");
    healthStatus.services.database = "UP";
    res.status(200).json(healthStatus);
  } catch (error: any) {
    healthStatus.status = "DEGRADED";
    healthStatus.services.database = "DOWN";
    healthStatus.error = error.message || "Failed to connect to database";
    res.status(500).json(healthStatus);
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api", webMvpRoutes);

// Serve OpenAPI Spec JSON
app.get("/api-docs.json", (req: Request, res: Response): void => {
  try {
    const swaggerPath = path.join(process.cwd(), "swagger.json");
    const rawData = fs.readFileSync(swaggerPath, "utf-8");
    res.status(200).json(JSON.parse(rawData));
  } catch (error: any) {
    res.status(500).json({ message: "Failed to load API docs", error: error.message });
  }
});

// Serve Premium Swagger UI HTML
app.get("/docs", (req: Request, res: Response): void => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Hi-Fi API Documentation 🚀</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <link rel="icon" type="image/png" href="https://unpkg.com/swagger-ui-dist@5/favicon-32x32.png" sizes="32x32" />
  <style>
    html { box-sizing: border-box; overflow: -margin-top-collapse; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin: 0; background: #fafafa; font-family: sans-serif; }
    .swagger-ui .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" charset="UTF-8"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js" charset="UTF-8"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/api-docs.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>`;
  res.status(200).send(html);
});

app.listen(PORT, () => {
  console.log("=========================================");
  console.log(`🚀 Express server running on: http://localhost:${PORT}`);
  console.log(`💚 Health Check endpoint:  http://localhost:${PORT}/health`);
  console.log(`📘 Interactive Swagger Docs: http://localhost:${PORT}/docs`);
  console.log("=========================================");
});
