const { env, assertValidEnv } = require("./config/env");
const { createApp } = require("./app");

async function main() {
  assertValidEnv();
  const app = createApp();

  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`SHORTURO backend running on http://localhost:${env.port}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

