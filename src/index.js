import "dotenv/config";
import app from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";

const port = parseInt(env.PORT);

app.listen(port, () => {
  logger.info("Budgy server started", {
    port,
    environment: env.NODE_ENV,
    supabaseUrl: env.SUPABASE_URL,
  });
  console.log(`\n  Budgy server running at http://localhost:${port}`);
  console.log(`  Health check: http://localhost:${port}/health`);
  console.log(`  Sync endpoint: POST http://localhost:${port}/api/sync\n`);
});
