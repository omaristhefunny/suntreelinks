import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { db } from "../lib/db.js";
import { linksTable } from "@workspace/db/schema";
import {
  buildLinkPageEmbed,
  buildPageButtons,
  ITEMS_PER_PAGE,
} from "../lib/pagination.js";

export const data = new SlashCommandBuilder()
  .setName("list")
  .setDescription("List all saved unblocked links");

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply();

  const results = await db
    .select()
    .from(linksTable)
    .orderBy(linksTable.name);

  if (results.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0xffaa00)
      .setTitle("📋 All Unblocked Links")
      .setDescription("No links have been added yet.")
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const embed = buildLinkPageEmbed(
    results,
    0,
    "📋 All Unblocked Links",
    0x5865f2,
    true
  );

  const components =
    results.length > ITEMS_PER_PAGE
      ? [buildPageButtons("list_page", 0, results.length)]
      : [];

  await interaction.editReply({ embeds: [embed], components });
}
