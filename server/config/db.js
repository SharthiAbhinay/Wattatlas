import { MongoClient } from "mongodb";

let client = null;
let clientPromise = null;

// One shared client for the whole app (routes, session store and scripts).
// The promise is reset when connecting fails, so the next request retries.
export function getClientPromise() {
  if (!clientPromise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error(
        "MONGODB_URI is not set. Copy .env.example to .env and fill it in."
      );
    }
    client = new MongoClient(uri);
    clientPromise = client.connect().catch((err) => {
      client = null;
      clientPromise = null;
      throw err;
    });
  }
  return clientPromise;
}

export function getDbName() {
  return process.env.DB_NAME || "wattatlas";
}

export async function connectDb() {
  await getClientPromise();
  return getDb();
}

export function getDb() {
  if (!client) throw new Error("Call connectDb() before getDb().");
  return client.db(getDbName());
}

export async function closeDb() {
  if (client) await client.close();
  client = null;
  clientPromise = null;
}
