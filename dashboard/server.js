import express from "express";
import session from "express-session";
import { Server } from "socket.io";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../src/config.js";

const __dirname = path.dirname(
  fileURLToPath(import.meta.url)
);

export function startDashboard(client, music, port) {
  const app = express();

  // Render reverse proxy support
  app.set("trust proxy", 1);

  const httpServer = createServer(app);

  const io = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: true
    }
  });

  app.use(express.json());
  app.use(
    express.urlencoded({
      extended: true
    })
  );

  app.use(
    session({
      secret: config.sessionSecret,

      resave: false,

      saveUninitialized: false,

      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: true,
        maxAge: 24 * 60 * 60 * 1000
      }
    })
  );


  /* =========================
     AUTH
  ========================= */

  function requireAuth(req, res, next) {
    if (!req.session.user) {
      return res.status(401).json({
        error: "Not authenticated"
      });
    }

    next();
  }


  /* =========================
     DISCORD LOGIN
  ========================= */

  app.get(
    "/auth/discord",
    (req, res) => {
      const params =
        new URLSearchParams({
          client_id:
            config.clientId,

          redirect_uri:
            config.redirectUri,

          response_type: "code",

          scope:
            "identify guilds"
        });

      res.redirect(
        `https://discord.com/oauth2/authorize?${params}`
      );
    }
  );


  /* =========================
     DISCORD CALLBACK
  ========================= */

  app.get(
    "/auth/discord/callback",
    async (req, res) => {
      try {
        const code =
          req.query.code;

        if (!code) {
          return res
            .status(400)
            .send(
              "Missing Discord authorization code."
            );
        }

        const body =
          new URLSearchParams({
            client_id:
              config.clientId,

            client_secret:
              config.clientSecret,

            grant_type:
              "authorization_code",

            code,

            redirect_uri:
              config.redirectUri
          });

        const tokenResponse =
          await fetch(
            "https://discord.com/api/oauth2/token",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/x-www-form-urlencoded"
              },

              body:
                body.toString()
            }
          );

        const token =
          await tokenResponse.json();

        if (!token.access_token) {
          console.error(
            "[dashboard] OAuth token error:",
            token
          );

          return res
            .status(500)
            .send(
              "Discord login failed."
            );
        }


        /* =====================
           USER
        ===================== */

        const userResponse =
          await fetch(
            "https://discord.com/api/users/@me",
            {
              headers: {
                Authorization:
                  `Bearer ${token.access_token}`
              }
            }
          );

        if (!userResponse.ok) {
          throw new Error(
            "Could not retrieve Discord user."
          );
        }

        const user =
          await userResponse.json();


        /* =====================
           GUILDS
        ===================== */

        const guildResponse =
          await fetch(
            "https://discord.com/api/users/@me/guilds",
            {
              headers: {
                Authorization:
                  `Bearer ${token.access_token}`
              }
            }
          );

        if (!guildResponse.ok) {
          throw new Error(
            "Could not retrieve Discord servers."
          );
        }

        const guilds =
          await guildResponse.json();


        /* =====================
           SESSION
        ===================== */

        req.session.user = {
          id: user.id,

          username:
            user.username,

          global_name:
            user.global_name,

          avatar:
            user.avatar,

          discriminator:
            user.discriminator,

          guilds
        };


        req.session.save(
          error => {
            if (error) {
              console.error(
                "[dashboard] Session save error:",
                error
              );

              return res
                .status(500)
                .send(
                  "Could not save login session."
                );
            }

            console.log(
              `[dashboard] Logged in: ${user.username}`
            );

            res.redirect("/");
          }
        );

      } catch (error) {
        console.error(
          "[dashboard] OAuth error:",
          error
        );

        res
          .status(500)
          .send(
            "Discord login failed."
          );
      }
    }
  );


  /* =========================
     CURRENT USER
  ========================= */

  app.get(
    "/api/me",
    requireAuth,
    (req, res) => {

      const sessionGuilds =
        Array.isArray(
          req.session.user.guilds
        )
          ? req.session.user.guilds
          : [];

      const guilds =
        sessionGuilds.filter(
          guild =>
            client.guilds.cache.has(
              guild.id
            )
        );

      res.json({
        user: {
          id:
            req.session.user.id,

          username:
            req.session.user.username,

          global_name:
            req.session.user.global_name,

          avatar:
            req.session.user.avatar,

          discriminator:
            req.session.user.discriminator
        },

        guilds
      });
    }
  );


  /* =========================
     GUILD INFO
  ========================= */

  app.get(
    "/api/guilds/:guildId",
    requireAuth,
    (req, res) => {

      const guild =
        client.guilds.cache.get(
          req.params.guildId
        );

      if (!guild) {
        return res.status(404).json({
          error:
            "Guild not found."
        });
      }

      res.json({
        id: guild.id,

        name: guild.name,

        icon:
          guild.iconURL({
            size: 128
          })
      });
    }
  );


  /* =========================
     PLAYER STATE
  ========================= */

  app.get(
    "/api/player/:guildId",
    requireAuth,
    (req, res) => {

      try {
        const player =
          music.get(
            req.params.guildId
          );

        res.json(
          player.state()
        );

      } catch {
        res.json({
          guildId:
            req.params.guildId,

          connected: false,

          current: null,

          queue: [],

          volume: 100,

          loop: "off",

          position: 0,

          paused: false
        });
      }
    }
  );


  /* =========================
     PLAYER ACTION
  ========================= */

  app.post(
    "/api/player/:guildId/action",
    requireAuth,
    async (req, res) => {

      const guildId =
        req.params.guildId;

      const action =
        req.body?.action;

      const player =
        music.get(guildId);

      try {

        if (action === "pause") {
          await player.pause();
        }

        else if (action === "resume") {
          await player.resume();
        }

        else if (action === "skip") {
          await player.skip();
        }

        else if (action === "stop") {
          await player.stop();
        }

        else if (action === "shuffle") {

          for (
            let i =
              player.queue.length - 1;

            i > 0;

            i--
          ) {

            const j =
              Math.floor(
                Math.random() *
                (i + 1)
              );

            [
              player.queue[i],
              player.queue[j]
            ] = [
              player.queue[j],
              player.queue[i]
            ];
          }

          player.emitUpdate();
        }

        else if (action === "volume") {

          const value =
            Number(
              req.body.value
            );

          if (
            !Number.isFinite(value) ||
            value < 0 ||
            value > 100
          ) {
            return res.status(400).json({
              error:
                "Volume must be between 0 and 100."
            });
          }

          await player.setVolume(
            value
          );
        }

        else if (action === "loop") {

          const value =
            req.body.value;

          if (
            value !== "off" &&
            value !== "track" &&
            value !== "queue"
          ) {
            return res.status(400).json({
              error:
                "Invalid loop mode."
            });
          }

          player.loop =
            value;

          player.emitUpdate();
        }

        else {
          return res.status(400).json({
            error:
              "Unknown action."
          });
        }

        const state =
          player.state();

        io.to(guildId).emit(
          "player:update",
          state
        );

        res.json(state);

      } catch (error) {

        console.error(
          "[dashboard] Player action error:",
          error
        );

        res.status(500).json({
          error:
            error?.message ||
            "Player action failed."
        });
      }
    }
  );


  /* =========================
     LOGOUT
  ========================= */

  app.get(
    "/logout",
    (req, res) => {

      req.session.destroy(
        error => {

          if (error) {
            console.error(
              "[dashboard] Logout error:",
              error
            );
          }

          res.clearCookie(
            "connect.sid"
          );

          res.redirect("/");
        }
      );
    }
  );


  /* =========================
     STATIC FILES
  ========================= */

  app.use(
    express.static(
      path.join(
        __dirname,
        "public"
      )
    )
  );


  /* =========================
     SOCKET.IO
  ========================= */

  io.on(
    "connection",
    socket => {

      console.log(
        `[dashboard] Socket connected: ${socket.id}`
      );

      socket.on(
        "guild:watch",
        guildId => {

          if (!guildId) {
            return;
          }

          socket.join(
            guildId
          );

          console.log(
            `[dashboard] ${socket.id} watching ${guildId}`
          );
        }
      );

      socket.on(
        "disconnect",
        () => {

          console.log(
            `[dashboard] Socket disconnected: ${socket.id}`
          );
        }
      );
    }
  );


  /* =========================
     START
  ========================= */

  httpServer.listen(
    port,
    "0.0.0.0",
    () => {

      console.log(
        `[dashboard] Listening on port ${port}`
      );
    }
  );


  return {
    app,
    httpServer,
    io
  };
}
