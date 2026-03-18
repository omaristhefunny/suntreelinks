import { REST, Routes } from "discord.js";
import * as add from "./commands/add.js";
import * as link from "./commands/link.js";
import * as remove from "./commands/remove.js";
import * as list from "./commands/list.js";
import * as filters from "./commands/filters.js";
import * as linkrequest from "./commands/linkrequest.js";

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!token || !clientId) {
  throw new Error("DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID must be set.");
}

const commands = [
  add.data,
  link.data,
  remove.data,
  list.data,
  filters.data,
  linkrequest.data,
].map((cmd) => cmd.toJSON());

const rest = new REST().setToken(token);

(async () => {
  try {
    console.log(`Registering ${commands.length} slash commands globally...`);
    const data = await rest.put(Routes.applicationCommands(clientId), {
      body: commands,
    });
    console.log(
      `Successfully registered ${(data as any[]).length} application commands.`
    );
  } catch (error) {
    console.error("Failed to register commands:", error);
    process.exit(1);
  }
})();
