import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { db } from "../lib/db.js";
import { linksTable } from "@workspace/db/schema";
import { eq, or, ilike } from "drizzle-orm";

export const data = new SlashCommandBuilder()
  .setName("remove")
  .setDescription("Remove an unblocked link (Admin only)")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((opt) =>
    opt
      .setName("query")
      .setDescription("Name or URL of the link to remove")
      .setRequired(true)
  );

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply({ flags: 64 });

  const member = interaction.member;
  const hasAdmin =
    member &&
    "permissions" in member &&
    typeof member.permissions !== "string" &&
    member.permissions.has(PermissionFlagsBits.Administrator);

  if (!hasAdmin) {
    const embed = new EmbedBuilder()
      .setColor(0xff4444)
      .setTitle("❌ Permission Denied")
      .setDescription("You need **Administrator** permission to use this command.")
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const query = interaction.options.getString("query", true).trim();

  let normalizedUrl = query;
  if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
    normalizedUrl = "https://" + normalizedUrl;
  }

  const existing = await db
    .select()
    .from(linksTable)
    .where(
      or(
        ilike(linksTable.name, `%${query}%`),
        eq(linksTable.url, query),
        eq(linksTable.url, normalizedUrl)
      )
    )
    .limit(1);

  if (existing.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0xff4444)
      .setTitle("❌ Link Not Found")
      .setDescription(
        `No link matching **${query}** was found.\nTry the exact name or URL.`
      )
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const link = existing[0];

  await db.delete(linksTable).where(eq(linksTable.id, link.id));

  const embed = new EmbedBuilder()
    .setColor(0x00cc66)
    .setTitle("🗑️ Link Removed")
    .setDescription(`**${link.name}** has been successfully removed.`)
    .addFields(
      { name: "Name", value: link.name, inline: true },
      { name: "URL", value: link.url, inline: true },
      { name: "Removed By", value: interaction.user.tag, inline: true }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
