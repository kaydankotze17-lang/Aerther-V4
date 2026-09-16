# Aether Music — Render Deployment

## Recommended Render layout

The repository contains a Render Blueprint (`render.yaml`) that creates:

1. `aether-dashboard` — public web service
2. `aether-bot` — background worker
3. `aether-lavalink` — private Lavalink service

### Deploy

1. Push this repository to GitHub.
2. In Render, choose **New > Blueprint** and select the repository.
3. Render reads `render.yaml`.
4. Enter the requested secret values.
5. Deploy.

### Required secrets

Dashboard:
- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_REDIRECT_URI`
- `LAVALINK_PASSWORD`

Bot:
- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `LAVALINK_PASSWORD`

The Lavalink host is wired to the private service by the Blueprint.

### Discord OAuth2

After Render creates the dashboard, copy its public URL and set:

`DISCORD_REDIRECT_URI=https://YOUR-DASHBOARD-URL/auth/discord/callback`

Then add that exact same URL to:

Discord Developer Portal -> Your Application -> OAuth2 -> Redirects

### Slash commands

Run the registration command once against the deployed bot:

`npm run register`

If you don't have a shell on the worker, run the command locally with the same `DISCORD_TOKEN` and `DISCORD_CLIENT_ID`, then redeploy/restart the bot.

### Important

The bot and dashboard are separate processes. Both connect to the same Lavalink service.

Do not put the Discord token, client secret, or Lavalink password in GitHub.
