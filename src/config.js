import "dotenv/config";

export const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  redirectUri: process.env.DISCORD_REDIRECT_URI || "http://localhost:3000/auth/discord/callback",
  lavalink: {
    host: process.env.LAVALINK_HOST || "localhost",
    port: Number(process.env.LAVALINK_PORT || 2333),
    password: process.env.LAVALINK_PASSWORD || "youshallnotpass",
    secure: String(process.env.LAVALINK_SECURE).toLowerCase() === "true"
  },
  dashboardPort: Number(process.env.DASHBOARD_PORT || 3000),
  sessionSecret: process.env.SESSION_SECRET || "development-secret"
};

for (const [key, value] of Object.entries({
  DISCORD_TOKEN: config.token,
  DISCORD_CLIENT_ID: config.clientId
})) {
  if (!value) console.warn(`[config] Missing ${key}`);
}
