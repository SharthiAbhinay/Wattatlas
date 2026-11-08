import dotenv from "dotenv";
import { createApp } from "./app.js";
import { connectDb } from "./config/db.js";
import { ensureIndexes } from "./config/indexes.js";

dotenv.config({ quiet: true });

const port = Number(process.env.PORT) || 3000;

try {
  await connectDb();
  await ensureIndexes();
  createApp().listen(port, () => {
    console.log(`WattAtlas is running at http://localhost:${port}`);
  });
} catch (err) {
  console.error(`WattAtlas could not start: ${err.message}`);
  process.exit(1);
}
