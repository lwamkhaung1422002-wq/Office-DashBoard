import "dotenv/config";
import express from "express";

const app = express();

const port = Number(process.env.PORT ?? 8800);

app.get("/", (req, res) => {
  res.json({
    message: "Office Data Manager API is running",
  });
});

app.listen(port, () => {
  console.log(`API running at http://localhost:${port}`);
});