// Testes automáticos do Estúdio. Rodar com: npm test
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 240_000,
  use: {
    baseURL: "http://localhost:5174",
    acceptDownloads: true,
    launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] },
  },
  webServer: {
    command: "node server.mjs",
    url: "http://localhost:5174",
    env: { PORT: "5174" },
    reuseExistingServer: true,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
