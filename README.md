# Aether Music — Discord Music Bot + Dashboard

A complete starter stack using Discord.js, Lavalink v4, Express, Socket.IO, and Discord OAuth2.

## Included
- Discord slash commands: play, pause, resume, skip, stop, queue, nowplaying, volume, loop, shuffle, disconnect
- Lavalink v4 client connection through Shoukaku
- Express dashboard API
- Discord OAuth2 login
- Guild picker
- Live player updates through Socket.IO
- Mobile-friendly dashboard
- Docker Compose for local development
- Railway-friendly Dockerfiles
- Environment-variable configuration

## Requirements
- Node.js 22+
- A Discord application/bot
- A Lavalink v4 server
- Discord OAuth2 redirect configured in your Discord application

## Setup
1. Copy `.env.example` to `.env`.
2. Fill in the Discord and Lavalink values.
3. Install dependencies:
   `npm install`
4. Start the bot:
   `npm run start`
5. Start the dashboard in another terminal:
   `npm run dashboard`
6. Open `http://localhost:3000`.

For local Lavalink:
`docker compose up -d lavalink`

The dashboard OAuth callback should be:
`http://localhost:3000/auth/discord/callback`

## Railway
You can deploy the bot and dashboard as separate services from this repository. Lavalink should be its own service/container. Set the same Lavalink host/password variables on the bot service.

Never commit `.env`.


## Render deployment

This repository includes `render.yaml`. Use Render Blueprint deployment to create the dashboard, bot worker, and Lavalink service together.

See `RENDER.md` for the exact setup.
