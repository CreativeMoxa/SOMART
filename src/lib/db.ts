import mongoose from "mongoose";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  handlersBound?: boolean;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = global.mongooseCache ?? { conn: null, promise: null };
global.mongooseCache = cache;

// Tuned for Vercel's serverless functions talking to Atlas:
// - fail fast (a few seconds) if the cluster is unreachable, so a request
//   returns an error page instead of hanging until the platform kills it —
//   which is what shows up in the browser as "this page can't be reached";
// - keep a small warm pool and close idle sockets so we never reuse a
//   connection Atlas has already dropped;
// - buffer a command briefly across a blip rather than throwing outright.
const CONNECT_OPTIONS: mongoose.ConnectOptions = {
  serverSelectionTimeoutMS: 8000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
  minPoolSize: 0,
  maxIdleTimeMS: 60000,
  heartbeatFrequencyMS: 10000,
  bufferCommands: true,
  retryWrites: true,
  retryReads: true,
};

// If the connection drops or errors, forget the cached handle so the next
// request reconnects instead of querying a dead socket.
function bindResetHandlers() {
  if (cache.handlersBound) return;
  cache.handlersBound = true;
  const reset = () => {
    cache.conn = null;
    cache.promise = null;
  };
  mongoose.connection.on("disconnected", reset);
  mongoose.connection.on("error", reset);
}

export async function connectDB() {
  // Fast path: reuse an already-open connection (readyState 1 = connected).
  if (cache.conn && mongoose.connection.readyState === 1) return cache.conn;

  // Read the URI at call time (runtime), not module load. A missing var must
  // fail the actual request — never the build, which evaluates this module
  // while collecting page data and would otherwise crash on an import-time throw.
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    throw new Error("Please define the MONGODB_URI environment variable in .env.local");
  }

  if (!cache.promise) {
    bindResetHandlers();
    cache.promise = mongoose.connect(MONGODB_URI, CONNECT_OPTIONS);
  }

  try {
    cache.conn = await cache.promise;
  } catch (err) {
    // Drop the failed promise so the next call retries with a fresh connect.
    cache.promise = null;
    throw err;
  }

  return cache.conn;
}
