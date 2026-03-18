import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { db } from "../lib/db.js";
import { linkRequestsTable } from "@workspace/db/schema";
import { FILTERS } from "../lib/filters.js";

const builder = new SlashCommandBuilder()
  .setName("linkrequest")
  .setDescription("Request a new unblocked link to be added")
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

  const name = interaction.options.getString("name", true);
  let url = interaction.options.getString("url", true);

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }

  const filterValues: Record<string, boolean> = {};
  for (const filter of FILTERS) {
    filterValues[filter.key] =
      interaction.options.getBoolean(filter.key) ?? false;
  }

  const bypassingFilters = FILTERS.filter((f) => filterValues[f.key]).map(
    (f) => f.label
  );

  const [request] = await db
    .insert(linkRequestsTable)
    .values({
      name,
      url,
      requestedBy: interaction.user.tag,
      requestedById: interaction.user.id,
      status: "pending",
      ...filterValues,
    } as any)
    .returning({ id: linkRequestsTable.id });

  const requestId = request.id;

  const requestEmbed = new EmbedBuilder()
    .setColor(0xffaa00)
    .setTitle("📥 New Link Request")
    .addFields(
      { name: "Name", value: name, inline: true },
      { name: "URL", value: url, inline: true },
      {
        name: "Bypasses Filters",
        value: bypassingFilters.length > 0 ? bypassingFilters.join(",\n") : "None",
        inline: false,
      },
      { name: "Requested By", value: `<@${interaction.user.id}>`, inline: true },
      { name: "Request ID", value: `#${requestId}`, inline: true }
    )
    .setFooter({ text: "Awaiting admin review" })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`approve_${requestId}`)
      .setLabel("✅ Approve")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`deny_${requestId}`)
      .setLabel("❌ Deny")
      .setStyle(ButtonStyle.Danger)
  );

  await interaction.channel!.send({
    embeds: [requestEmbed],
    components: [row],
  });

  const confirmEmbed = new EmbedBuilder()
    .setColor(0x00cc66)
    .setTitle("✅ Request Submitted")
    .setDescription("Your link request has been posted for admin review.")
    .setTimestamp();

  await interaction.editReply({ embeds: [confirmEmbed] });
}
