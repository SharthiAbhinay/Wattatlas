// The entry point Vercel runs. vercel.json sends every /api request here, and
// the app itself is built in server/app.js. Vercel serves the built React app
// from frontend/dist on its CDN, so Express only handles the API.
import { createApp } from "../server/app.js";

export default createApp();
