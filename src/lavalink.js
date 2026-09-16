import { Connectors, Shoukaku } from "shoukaku";
import { Client } from "discord.js";
import { config } from "./config.js";

export function createLavalink(client) {
  const nodes = [
    {
      name: "main",
      url: `${config.lavalink.host}:${config.lavalink.port}`,
      auth: config.lavalink.password,
      secure: config.lavalink.secure
    }
  ];

  const shoukaku = new Shoukaku(
    new Connectors.DiscordJS(client),
    nodes,
    {
      moveOnDisconnect: true,
      resumable: true,
      resumableTimeout: 30,
      reconnectTries: 10,
      restTimeout: 10000
    }
  );

  shoukaku.on("ready", (name) => console.log(`[lavalink] Node ready: ${name}`));
  shoukaku.on("error", (name, error) => console.error(`[lavalink] ${name}:`, error));
  shoukaku.on("close", (name, code, reason) =>
    console.warn(`[lavalink] ${name} closed: ${code} ${reason || ""}`)
  );
  shoukaku.on("debug", (name, info) => console.log(`[lavalink:debug] ${name}: ${info}`));

  return shoukaku;
}
