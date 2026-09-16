import {
  Client,
  GatewayIntentBits,
  Events,
  EmbedBuilder
} from "discord.js";

import { config } from "./config.js";
import { createLavalink } from "./lavalink.js";
import { MusicManager } from "./musicManager.js";
import { startDashboard } from "../dashboard/server.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const lavalink = createLavalink(client);
const music = new MusicManager(lavalink);


/* =========================
   TRACK HELPERS
========================= */

function textTrack(track) {
  const info = track.info || {};

  return {
    encoded: track.encoded,
    info
  };
}


/* =========================
   RESOLVE MUSIC
========================= */

async function resolveAndPlay(player, query) {
  const node = lavalink.getIdealNode();

  if (!node) {
    throw new Error(
      "No Lavalink node is available."
    );
  }

  console.log(`[music] Resolving query: ${query}`);
  const result = await node.rest.resolve(query);
  console.log(`[music] Resolve result: ${result?.loadType}`);

  if (!result?.data) {
    throw new Error(
      "Lavalink returned no results."
    );
  }

  let tracks = [];

  if (
    result.loadType === "search" ||
    result.loadType === "track"
  ) {
    tracks =
      result.loadType === "track"
        ? [result.data]
        : result.data;
  }

  else if (result.loadType === "playlist") {
    tracks = result.data.tracks;
  }

  else if (result.loadType === "empty") {
    throw new Error(
      "Nothing was found."
    );
  }

  else if (result.loadType === "error") {
    throw new Error(
      result.data?.message ||
      "Lavalink could not load that query."
    );
  }

  if (!tracks.length) {
    throw new Error(
      "Nothing playable was found."
    );
  }

  const selected = tracks[0];

  const added = textTrack(selected);

  const wasPlaying =
    Boolean(player.current);

  player.enqueue(added);

  if (!wasPlaying) {
    console.log("[music] Starting playback...");
    await player.playNext();
    console.log("[music] Playback started.");
  }

  return {
    title:
      selected.info?.title ||
      "Unknown",

    author:
      selected.info?.author ||
      "Unknown",

    count: tracks.length
  };
}


/* =========================
   PLAYER → DASHBOARD
========================= */

function connectDashboardPlayer(player) {
  if (player.__dashboardConnected) {
    return;
  }

  player.__dashboardConnected = true;

  player.on("update", state => {
    if (globalThis.dashboardIO) {
      globalThis.dashboardIO
        .to(player.guildId)
        .emit(
          "player:update",
          state
        );
    }
  });
}


/* =========================
   DISCORD READY
========================= */

client.once(
  Events.ClientReady,
  ready => {
    console.log(
      `[discord] Logged in as ${ready.user.tag}`
    );
  }
);


/* =========================
   DISCORD COMMANDS
========================= */

client.on(
  Events.InteractionCreate,
  async interaction => {

    if (
      !interaction.isChatInputCommand() ||
      !interaction.guildId
    ) {
      return;
    }

    const player =
      music.get(interaction.guildId);

    connectDashboardPlayer(player);

    try {

      /* =====================
         PLAY
      ===================== */

      if (
        interaction.commandName === "play"
      ) {
        const member =
          interaction.member;

        const channel =
          member?.voice?.channel;

        if (!channel) {
          return interaction.reply({
            content:
              "Join a voice channel first.",
            ephemeral: true
          });
        }

        if (!player.player) {
          await player.connect(
            channel.id
          );
        }

        await interaction.deferReply();

        const result =
          await resolveAndPlay(
            player,
            interaction.options.getString(
              "query",
              true
            )
          );

        return interaction.editReply(
          `Queued: **${result.title}** — ${result.author}`
        );
      }


      /* =====================
         PAUSE
      ===================== */

      if (
        interaction.commandName === "pause"
      ) {
        await player.pause();

        return interaction.reply(
          "Paused."
        );
      }


      /* =====================
         RESUME
      ===================== */

      if (
        interaction.commandName === "resume"
      ) {
        await player.resume();

        return interaction.reply(
          "Resumed."
        );
      }


      /* =====================
         SKIP
      ===================== */

      if (
        interaction.commandName === "skip"
      ) {
        await player.skip();

        return interaction.reply(
          "Skipped."
        );
      }


      /* =====================
         STOP
      ===================== */

      if (
        interaction.commandName === "stop"
      ) {
        await player.stop();

        return interaction.reply(
          "Stopped and cleared the queue."
        );
      }


      /* =====================
         QUEUE
      ===================== */

      if (
        interaction.commandName === "queue"
      ) {
        const state =
          player.state();

        const lines =
          state.queue
            .slice(0, 15)
            .map(
              (track, index) =>
                `${index + 1}. ${track.title} — ${track.author}`
            );

        return interaction.reply(
          lines.length
            ? lines.join("\n")
            : "The queue is empty."
        );
      }


      /* =====================
         NOW PLAYING
      ===================== */

      if (
        interaction.commandName ===
        "nowplaying"
      ) {
        const state =
          player.state();

        if (!state.current) {
          return interaction.reply(
            "Nothing is playing."
          );
        }

        const embed =
          new EmbedBuilder()
            .setTitle(
              state.current.title
            )
            .setDescription(
              state.current.author
            )
            .setURL(
              state.current.uri ||
              null
            )
            .addFields(
              {
                name: "Volume",
                value:
                  `${state.volume}%`,
                inline: true
              },
              {
                name: "Loop",
                value:
                  state.loop,
                inline: true
              }
            );

        if (
          state.current.artworkUrl
        ) {
          embed.setThumbnail(
            state.current.artworkUrl
          );
        }

        return interaction.reply({
          embeds: [embed]
        });
      }


      /* =====================
         VOLUME
      ===================== */

      if (
        interaction.commandName ===
        "volume"
      ) {
        const amount =
          interaction.options.getInteger(
            "amount",
            true
          );

        await player.setVolume(
          amount
        );

        return interaction.reply(
          `Volume set to ${amount}%.`
        );
      }


      /* =====================
         LOOP
      ===================== */

      if (
        interaction.commandName ===
        "loop"
      ) {
        player.loop =
          interaction.options.getString(
            "mode",
            true
          );

        player.emitUpdate();

        return interaction.reply(
          `Loop mode: ${player.loop}`
        );
      }


      /* =====================
         SHUFFLE
      ===================== */

      if (
        interaction.commandName ===
        "shuffle"
      ) {

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

        return interaction.reply(
          "Queue shuffled."
        );
      }


      /* =====================
         DISCONNECT
      ===================== */

      if (
        interaction.commandName ===
        "disconnect"
      ) {

        await player.disconnect();

        music.remove(
          interaction.guildId
        );

        return interaction.reply(
          "Disconnected."
        );
      }

    } catch (error) {

      console.error(error);

      const message =
        error?.message ||
        "Something went wrong.";

      if (
        interaction.deferred
      ) {
        return interaction.editReply(
          `Error: ${message}`
        );
      }

      return interaction.reply({
        content:
          `Error: ${message}`,
        ephemeral: true
      });
    }
  }
);


/* =========================
   DASHBOARD
========================= */

const dashboard =
  startDashboard(
    client,
    music,
    Number(
      process.env.PORT ||
      3000
    )
  );


/*
 * Give the dashboard Socket.IO
 * instance to the player system.
 */

globalThis.dashboardIO =
  dashboard.io;


/* =========================
   LOGIN
========================= */

await client.login(
  config.token
);


export {
  client,
  music
};
