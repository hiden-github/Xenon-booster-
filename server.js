const express = require("express");
const axios = require("axios");
const crypto = require("crypto"); 
const path = require("path");
/** const { webcrack } = require("webcrack"); */

const app = express();
app.use(express.static(path.join(__dirname, "public"), {
  etag: true,
  maxAge: 0
}));
app.get("/favicon.ico", (_req, res) => res.status(204).end());
const PORT = Number(process.env.PORT || 8080);



 /** app.post('/api/deobfuscate', async (req, res) => {
  try {
    const { code, options = {} } = req.body;

    if (typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({
        status: false,
        error: 'code is required'
      });
    }

    const result = await Promise.race([
      webcrack(code, {
        jsx: options.jsx !== false,
        unpack: options.unpack !== false,
        unminify: options.unminify !== false,
        deobfuscate: options.deobfuscate !== false,
        mangle: options.mangle === true,
        plugins: {}
      }),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('WebCrack timeout'));
        }, 30000);
      })
    ]);

    res.json({
      status: true,
      code: result.code
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      status: false,
      error: error.message || 'Deobfuscation failed'
    });
  }
}); **/




const API_URL = process.env.API_URL || "https://nikoxsmm.site/api/v2";
const API_KEY = "8083290977cb8c4566e9b886e0138e92";
const ADMIN_USER = process.env.ADMIN_USER || "yazkyxyz";
const ADMIN_PASS = process.env.ADMIN_PASS || "yazkyswordjan";

const sessions = new Map();

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

function clean(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function splitIds(value) {
  return clean(value)
    .split(",")
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 100);
}

function parseCookies(req) {
  const cookies = {};
  const header = req.headers.cookie || "";

  header.split(";").forEach(item => {
    const index = item.indexOf("=");

    if (index === -1) return;

    const key = item.slice(0, index).trim();
    const value = item.slice(index + 1).trim();

    cookies[key] = decodeURIComponent(value);
  });

  return cookies;
}

function createSession() {
  return crypto.randomBytes(32).toString("hex");
}

function isAuthenticated(req) {
  const cookies = parseCookies(req);
  const token = cookies.xenon_session;

  if (!token) return false;

  const session = sessions.get(token);

  if (!session) return false;

  if (Date.now() > session.expires) {
    sessions.delete(token);
    return false;
  }

  return true;
}

function requireAuth(req, res, next) {
  if (!isAuthenticated(req)) {
    return res.status(401).json({
      error: "Unauthorized",
      authenticated: false
    });
  }

  next();
}

async function provider(data) {
  if (!API_KEY) {
    const error = new Error("API key is not configured.");
    error.status = 503;
    throw error;
  }

  const payload = new URLSearchParams({
    key: API_KEY
  });

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null && value !== "") {
      payload.append(key, String(value));
    }
  }

  const response = await axios.post(
    API_URL,
    payload.toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json"
      },
      timeout: 30000,
      validateStatus: () => true
    }
  );

  if (response.status < 200 || response.status >= 300) {
    const error = new Error(`Provider returned HTTP ${response.status}`);
    error.status = 502;
    error.provider = response.data;
    throw error;
  }

  return response.data;
}

function sendError(res, error) {
  res.status(Number(error.status) || 500).json({
    error: error.message || "Request failed",
    provider: error.provider ?? null
  });
}

app.post("/api/login", (req, res) => {
  const username = clean(req.body.username);
  const password = clean(req.body.password);

  if (username !== ADMIN_USER || password !== ADMIN_PASS) {
    return res.status(401).json({
      error: "Invalid username or password."
    });
  }

  const token = createSession();

  sessions.set(token, {
    expires: Date.now() + 1000 * 60 * 60 * 24
  });

  res.setHeader(
    "Set-Cookie",
    `xenon_session=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=86400`
  );

  res.json({
    ok: true,
    authenticated: true
  });
});

app.post("/api/logout", (req, res) => {
  const cookies = parseCookies(req);
  const token = cookies.xenon_session;

  if (token) {
    sessions.delete(token);
  }

  res.setHeader(
    "Set-Cookie",
    "xenon_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0"
  );

  res.json({
    ok: true
  });
});

app.get("/api/auth", (req, res) => {
  res.json({
    authenticated: isAuthenticated(req)
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    configured: Boolean(API_KEY),
    provider: API_URL
  });
});

app.use("/api", requireAuth);

app.get("/api/services", async (_req, res) => {
  try {
    res.json(await provider({
      action: "services"
    }));
  } catch (error) {
    sendError(res, error);
  }
});

app.get("/api/balance", async (_req, res) => {
  try {
    res.json(await provider({
      action: "balance"
    }));
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/api/order", async (req, res) => {
  try {
    const service = clean(req.body.service);
    const link = clean(req.body.link);
    const quantity = clean(req.body.quantity);

    if (!service || !link || !quantity) {
      return res.status(400).json({
        error: "service, link and quantity are required"
      });
    }

    res.json(await provider({
      action: "add",
      service,
      link,
      quantity
    }));
  } catch (error) {
    sendError(res, error);
  }
});

app.get("/api/status/:order", async (req, res) => {
  try {
    const order = clean(req.params.order);

    if (!order) {
      return res.status(400).json({
        error: "order is required"
      });
    }

    res.json(await provider({
      action: "status",
      order
    }));
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/api/status", async (req, res) => {
  try {
    const orders = splitIds(req.body.orders);

    if (!orders.length) {
      return res.status(400).json({
        error: "No valid order IDs supplied"
      });
    }

    const results = {};

    await Promise.all(
      orders.map(async order => {
        try {
          results[order] = await provider({
            action: "status",
            order
          });
        } catch (error) {
          results[order] = {
            error: error.message || "Failed to check this order."
          };
        }
      })
    );

    res.json(results);
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/api/refill", async (req, res) => {
  try {
    const order = clean(req.body.order);

    if (!order) {
      return res.status(400).json({
        error: "order is required"
      });
    }

    res.json(await provider({
      action: "refill",
      order
    }));
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/api/refill-multiple", async (req, res) => {
  try {
    const orders = splitIds(req.body.orders);

    if (!orders.length) {
      return res.status(400).json({
        error: "No valid order IDs supplied"
      });
    }

    res.json(await provider({
      action: "refill",
      orders: orders.join(",")
    }));
  } catch (error) {
    sendError(res, error);
  }
});

app.get("/api/refill-status/:refill", async (req, res) => {
  try {
    const refill = clean(req.params.refill);

    if (!refill) {
      return res.status(400).json({
        error: "refill is required"
      });
    }

    res.json(await provider({
      action: "refill_status",
      refill
    }));
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/api/refill-status", async (req, res) => {
  try {
    const refills = splitIds(req.body.refills);

    if (!refills.length) {
      return res.status(400).json({
        error: "No valid refill IDs supplied"
      });
    }

    res.json(await provider({
      action: "refill_status",
      refills: refills.join(",")
    }));
  } catch (error) {
    sendError(res, error);
  }
}); 

app.get("/xenon-booster.png", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "xenon-booster.png")
  );
});

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});

app.listen(PORT, () => {
  console.log(`Xenon Booster running on port ${PORT}`);
});
