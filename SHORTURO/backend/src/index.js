const { env, assertValidEnv } = require("./config/env");
const { createApp } = require("./app");
const { connectDb } = require("./db");

async function main() {
  assertValidEnv();
  await connectDb(env.mongoUri);
  const app = createApp();

  app.listen(env.port, () => {
    console.log(`SHORTURO backend running on http://localhost:${env.port}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
