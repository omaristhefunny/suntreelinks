import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { db } from "../lib/db.js";
import { linksTable } from "@workspace/db/schema";
import { FILTERS, getFilterLabel, type FilterKey } from "../lib/filters.js";
import { eq } from "drizzle-orm";
import {
  buildLinkPageEmbed,
  buildPageButtons,
  ITEMS_PER_PAGE,
} from "../lib/pagination.js";

export const data = new SlashCommandBuilder()
  .setName("link")
  .setDescription("Find links that bypass a specific school filter")
  .addStringOption((opt) => {
    opt
      .setName("filter")
      .setDescription("Select the filter to search for")
      .setRequired(true);
    for (const filter of FILTERS) {
      opt.addChoices({ name: filter.label, value: filter.key });
    }
    return opt;
  });

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply();

  const filterKey = interaction.options.getString("filter", true) as FilterKey;
  const filterLabel = getFilterLabel(filterKey);

  const column = linksTable[filterKey as keyof typeof linksTable];
  const results = await db
    .select()
    .from(linksTable)
    .where(eq(column as any, true))
    .orderBy(linksTable.name);

  if (results.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0xffaa00)
      .setTitle(`🔍 Links bypassing ${filterLabel}`)
      .setDescription(`No links currently bypass **${filterLabel}**.`)
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const embed = buildLinkPageEmbed(
    results,
    0,
    `🔓 Links that bypass ${filterLabel}`,
    0x5865f2,
    false
  );

  const components =
    results.length > ITEMS_PER_PAGE
      ? [buildPageButtons(`link_page_${filterKey}`, 0, results.length)]
      : [];

  await interaction.editReply({ embeds: [embed], components });
}
