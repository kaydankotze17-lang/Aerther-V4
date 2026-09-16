import {
  Client,
  GatewayIntentBits,
  Events,
  EmbedBuilder
} from "discord.js";
import { createServer } from "node:http";
import { config } from "./config.js";
import { createLavalink } from "./lavalink.js";
import { MusicManager } from "./musicManager.js";

const PORT = Number(process.env.PORT || 3000);

const healthServer = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Aether V4 is online.");
});

healthServer.listen(PORT, "0.0.0.0", () => {
  console.log(`[web] Health server listening on port ${PORT}`);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const lavalink = createLavalink(client);
const music = new MusicManager(lavalink);

function textTrack(track) {
  const info = track.info || {};
  return {
    encoded: track.encoded,
    info
  };
}

async function resolveAndPlay(player, query, interaction) {
  const node = lavalink.getIdealNode();
  if (!node) throw new Error("No Lavalink node is available.");

  const result = await node.rest.resolve(query);
  if (!result?.data) throw new Error("Lavalink returned no results.");

  let tracks = [];
  if (result.loadType === "search" || result.loadType === "track") {
    tracks = result.loadType === "track" ? [result.data] : result.data;
  } else if (result.loadType === "playlist") {
    tracks = result.data.tracks;
  } else if (result.loadType === "empty") {
    throw new Error("Nothing was found.");
  } else if (result.loadType === "error") {
    throw new Error(result.data?.message || "Lavalink could not load that query.");
  }

  if (!tracks.length) throw new Error("Nothing playable was found.");

  const selected = tracks[0];
  const added = textTrack(selected);
  const wasPlaying = Boolean(player.current);

  player.enqueue(added);
  if (!wasPlaying) await player.playNext();

  return {
    title: selected.info?.title || "Unknown",
    author: selected.info?.author || "Unknown",
    count: tracks.length
  };
}

client.once(Events.ClientReady, (ready) => {
  console.log(`[discord] Logged in as ${ready.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() || !interaction.guildId) return;

  const player = music.get(interaction.guildId);

  try {
    if (interaction.commandName === "play") {
      const member = interaction.member;
      const channel = member?.voice?.channel;
      if (!channel) return interaction.reply({ content: "Join a voice channel first.", ephemeral: true });

      if (!player.player) await player.connect(channel.id);

      await interaction.deferReply();
      const result = await resolveAndPlay(player, interaction.options.getString("query", true), interaction);
      return interaction.editReply(`Queued: **${result.title}** — ${result.author}`);
    }

    if (interaction.commandName === "pause") {
      await player.pause();
      return interaction.reply("Paused.");
    }

    if (interaction.commandName === "resume") {
      await player.resume();
      return interaction.reply("Resumed.");
    }

    if (interaction.commandName === "skip") {
      await player.skip();
      return interaction.reply("Skipped.");
    }

    if (interaction.commandName === "stop") {
      await player.stop();
      return interaction.reply("Stopped and cleared the queue.");
    }

    if (interaction.commandName === "queue") {
      const s = player.state();
      const lines = s.queue.slice(0, 15).map((x, i) => `${i + 1}. ${x.title} — ${x.author}`);
      return interaction.reply(lines.length ? lines.join("\n") : "The queue is empty.");
    }

    if (interaction.commandName === "nowplaying") {
      const s = player.state();
      if (!s.current) return interaction.reply("Nothing is playing.");
      const e = new EmbedBuilder()
        .setTitle(s.current.title)
        .setDescription(s.current.author)
        .setURL(s.current.uri || null)
        .addFields(
          { name: "Volume", value: `${s.volume}%`, inline: true },
          { name: "Loop", value: s.loop, inline: true }
        );
      if (s.current.artworkUrl) e.setThumbnail(s.current.artworkUrl);
      return interaction.reply({ embeds: [e] });
    }

    if (interaction.commandName === "volume") {
      const amount = interaction.options.getInteger("amount", true);
      await player.setVolume(amount);
      return interaction.reply(`Volume set to ${amount}%.`);
    }

    if (interaction.commandName === "loop") {
      player.loop = interaction.options.getString("mode", true);
      return interaction.reply(`Loop mode: ${player.loop}`);
    }

    if (interaction.commandName === "shuffle") {
      for (let i = player.queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [player.queue[i], player.queue[j]] = [player.queue[j], player.queue[i]];
      }
      return interaction.reply("Queue shuffled.");
    }

    if (interaction.commandName === "disconnect") {
      await player.disconnect();
      music.remove(interaction.guildId);
      return interaction.reply("Disconnected.");
    }
  } catch (error) {
    console.error(error);
    const message = error?.message || "Something went wrong.";
    if (interaction.deferred) return interaction.editReply(`Error: ${message}`);
    return interaction.reply({ content: `Error: ${message}`, ephemeral: true });
  }
});

await client.login(config.token);

export { client, music };

