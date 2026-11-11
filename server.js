const express = require("express");
const axios = require("axios");
const crypto = require("crypto"); 
const path = require("path");

const app = express();
app.use(express.static(path.join(__dirname, "public"), {
  etag: true,
  maxAge: 0
}));
app.get("/favicon.ico", (_req, res) => res.status(204).end());
const PORT = Number(process.env.PORT || 8080);

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});

app.listen(8080);
