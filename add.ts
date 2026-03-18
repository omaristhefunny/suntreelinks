import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { db } from "../lib/db.js";
import { linksTable } from "@workspace/db/schema";
import { FILTERS } from "../lib/filters.js";
import { eq } from "drizzle-orm";

const builder = new SlashCommandBuilder()
  .setName("add")
  .setDescription("Add a new unblocked link (Admin only)")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((opt) =>
    opt.setName("name").setDescription("Name of the website").setRequired(true)
  )
  .addStringOption((opt) =>
    opt.setName("url").setDescription("URL of the website").setRequired(true)
  );

for (const filter of FILTERS) {
  builder.addBooleanOption((opt) =>
    opt
      .setName(filter.key)
      .setDescription(`Bypasses ${filter.label}?`)
      .setRequired(false)
  );
}

export const data = builder;

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

  const name = interaction.options.getString("name", true);
  let url = interaction.options.getString("url", true);

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }

  const existing = await db
    .select()
    .from(linksTable)
    .where(eq(linksTable.url, url))
    .limit(1);

  if (existing.length > 0) {
    const embed = new EmbedBuilder()
      .setColor(0xff4444)
      .setTitle("❌ Duplicate Link")
      .setDescription(`A link with URL **${url}** already exists in the database.`)
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const filterValues: Record<string, boolean> = {};
  for (const filter of FILTERS) {
    filterValues[filter.key] =
      interaction.options.getBoolean(filter.key) ?? false;
  }

  const bypassingFilters = FILTERS.filter((f) => filterValues[f.key]).map(
    (f) => f.label
  );

  await db.insert(linksTable).values({
    name,
    url,
    addedBy: interaction.user.tag,
    ...filterValues,
  } as any);

  const embed = new EmbedBuilder()
    .setColor(0x00cc66)
    .setTitle("✅ Link Added Successfully")
    .addFields(
      { name: "Name", value: name, inline: true },
      { name: "URL", value: url, inline: true },
      {
        name: "Bypasses Filters",
        value: bypassingFilters.length > 0 ? bypassingFilters.join(",\n") : "None",
        inline: false,
      },
      { name: "Added By", value: interaction.user.tag, inline: true }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
