import {
  SlashCommandBuilder,
  PermissionFlagsBits
} from "discord.js";

export const commands = [
  new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a song or search for music.")
    .addStringOption(o => o.setName("query").setDescription("Song name or URL").setRequired(true)),
  new SlashCommandBuilder().setName("pause").setDescription("Pause the current track."),
  new SlashCommandBuilder().setName("resume").setDescription("Resume playback."),
  new SlashCommandBuilder().setName("skip").setDescription("Skip the current track."),
  new SlashCommandBuilder().setName("stop").setDescription("Stop playback and clear the queue."),
  new SlashCommandBuilder().setName("queue").setDescription("Show the current queue."),
  new SlashCommandBuilder().setName("nowplaying").setDescription("Show the current track."),
  new SlashCommandBuilder()
    .setName("volume")
    .setDescription("Set player volume.")
    .addIntegerOption(o => o.setName("amount").setDescription("0-150").setRequired(true).setMinValue(0).setMaxValue(150)),
  new SlashCommandBuilder()
    .setName("loop")
    .setDescription("Set loop mode.")
    .addStringOption(o => o.setName("mode").setDescription("Loop mode").setRequired(true)
      .addChoices(
        { name: "off", value: "off" },
        { name: "track", value: "track" },
        { name: "queue", value: "queue" }
      )),
  new SlashCommandBuilder().setName("shuffle").setDescription("Shuffle the queue."),
  new SlashCommandBuilder()
    .setName("disconnect")
    .setDescription("Disconnect from voice.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
].map(c => c.toJSON());
