import express from "express";
import session from "express-session";
import { Server } from "socket.io";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../src/config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function startDashboard(client, music, port) {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: 86400000
    }
  }));

  function requireAuth(req, res, next) {
    if (!req.session.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    next();
  }

  app.get("/auth/discord", (req, res) => {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: "identify guilds"
    });

    res.redirect(`https://discord.com/oauth2/authorize?${params}`);
  });

  app.get("/auth/discord/callback", async (req, res) => {
    try {
      const body = new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "authorization_code",
        code: req.query.code,
        redirect_uri: config.redirectUri
      });

      const tokenResponse = await fetch(
        "https://discord.com/api/oauth2/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body
        }
      );

      const token = await tokenResponse.json();

      if (!token.access_token) {
        throw new Error("OAuth token exchange failed.");
      }

      const userResponse = await fetch(
        "https://discord.com/api/users/@me",
        {
          headers: {
            Authorization: `Bearer ${token.access_token}`
          }
        }
      );

      const user = await userResponse.json();

      const guildResponse = await fetch(
        "https://discord.com/api/users/@me/guilds",
        {
          headers: {
            Authorization: `Bearer ${token.access_token}`
          }
        }
      );

      const guilds = await guildResponse.json();

      req.session.user = {
        ...user,
        guilds
      };

      res.redirect("/");
    } catch (error) {
      console.error("[dashboard] OAuth error:", error);
      res.status(500).send("Discord login failed.");
    }
  });

  app.get("/api/me", requireAuth, (req, res) => {
    res.json({
      user: req.session.user,
      guilds: req.session.user.guilds.filter(guild =>
        client.guilds.cache.has(guild.id)
      )
    });
  });

  app.get("/api/guilds/:guildId", requireAuth, (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);

    if (!guild) {
      return res.status(404).json({
        error: "Guild not found."
      });
    }

    res.json({
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL({ size: 128 })
    });
  });

  app.get("/api/player/:guildId", requireAuth, (req, res) => {
    try {
      res.json(music.get(req.params.guildId).state());
    } catch {
      res.json({
        guildId: req.params.guildId,
        connected: false,
        current: null,
        queue: []
      });
    }
  });

  app.post("/api/player/:guildId/action", requireAuth, async (req, res) => {
    const player = music.get(req.params.guildId);
    const action = req.body.action;

    try {
      if (action === "pause") {
        await player.pause();
      } else if (action === "resume") {
        await player.resume();
      } else if (action === "skip") {
        await player.skip();
      } else if (action === "stop") {
        await player.stop();
      } else if (action === "shuffle") {
        for (let i = player.queue.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [player.queue[i], player.queue[j]] =
            [player.queue[j], player.queue[i]];
        }
      } else if (action === "volume") {
        await player.setVolume(req.body.value);
      } else if (action === "loop") {
        player.loop = req.body.value;
      } else {
        return res.status(400).json({
          error: "Unknown action."
        });
      }

      io.to(req.params.guildId).emit(
        "player:update",
        player.state()
      );

      res.json(player.state());
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  });

  app.get("/logout", (req, res) => {
    req.session.destroy(() => {
      res.redirect("/");
    });
  });

  app.use(express.static(path.join(__dirname, "public")));

  io.on("connection", socket => {
    socket.on("guild:watch", guildId => {
      socket.join(guildId);
    });
  });

  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`[dashboard] Listening on port ${port}`);
  });
}
