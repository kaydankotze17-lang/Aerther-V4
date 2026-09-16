import "dotenv/config";
import { REST, Routes } from "discord.js";
import { commands } from "./commands.js";

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
const clientId = process.env.DISCORD_CLIENT_ID;

await rest.put(
  Routes.applicationCommands(clientId),
  { body: [] }
);

console.log("Cleared all global Discord commands.");

await rest.put(
  Routes.applicationCommands(clientId),
  { body: commands }
);

console.log(`Registered ${commands.length} current commands.`);
