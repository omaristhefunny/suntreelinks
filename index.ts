import {
  Client,
  GatewayIntentBits,
  Collection,
  ChatInputCommandInteraction,
  Events,
  EmbedBuilder,
  ButtonInteraction,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import * as add from "./commands/add.js";
import * as link from "./commands/link.js";
import * as remove from "./commands/remove.js";
import * as list from "./commands/list.js";
import * as filters from "./commands/filters.js";
import * as linkrequest from "./commands/linkrequest.js";
import { db } from "./lib/db.js";
import { linksTable, linkRequestsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { FILTERS, getFilterLabel, type FilterKey } from "./lib/filters.js";
import {
  buildLinkPageEmbed,
  buildPageButtons,
  ITEMS_PER_PAGE,
} from "./lib/pagination.js";

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) throw new Error("DISCORD_BOT_TOKEN must be set.");

type Command = {
  data: { name: string; toJSON: () => unknown };
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
};

const commands = new Collection<string, Command>();
for (const cmd of [add, link, remove, list, filters, linkrequest]) {
  commands.set(cmd.data.name, cmd as Command);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Logged in as ${c.user.tag}`);
  console.log(`Serving ${c.guilds.cache.size} guild(s).`);
});

async function handlePagination(interaction: ButtonInteraction): Promise<void> {
  const { customId } = interaction;

  if (customId.startsWith("list_page_")) {
    const page = parseInt(customId.slice("list_page_".length), 10);
    if (isNaN(page) || page < 0) return;

    const results = await db
      .select()
      .from(linksTable)
      .orderBy(linksTable.name);

    const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE);
    if (page >= totalPages) return;

    const embed = buildLinkPageEmbed(
      results,
      page,
      "📋 All Unblocked Links",
      0x5865f2,
      true
    );
    const row = buildPageButtons("list_page", page, results.length);
    await interaction.update({ embeds: [embed], components: [row] });
    return;
  }

  if (customId.startsWith("link_page_")) {
    const rest = customId.slice("link_page_".length);
    const lastUnder = rest.lastIndexOf("_");
    if (lastUnder === -1) return;

    const filterKey = rest.slice(0, lastUnder) as FilterKey;
    const page = parseInt(rest.slice(lastUnder + 1), 10);
    if (isNaN(page) || page < 0) return;

    const filterLabel = getFilterLabel(filterKey);
    const column = linksTable[filterKey as keyof typeof linksTable];
    const results = await db
      .select()
      .from(linksTable)
      .where(eq(column as any, true))
      .orderBy(linksTable.name);

    const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE);
    if (page >= totalPages) return;

    const embed = buildLinkPageEmbed(
      results,
      page,
      `🔓 Links that bypass ${filterLabel}`,
      0x5865f2,
      false
    );
    const row = buildPageButtons(`link_page_${filterKey}`, page, results.length);
    await interaction.update({ embeds: [embed], components: [row] });
    return;
  }
}

async function handleApprovalButton(interaction: ButtonInteraction): Promise<void> {
  const { customId } = interaction;

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
      .setDescription("Only **Administrators** can approve or deny link requests.")
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const isApprove = customId.startsWith("approve_");
  const requestId = parseInt(customId.split("_")[1], 10);
  if (isNaN(requestId)) return;

  const [request] = await db
    .select()
    .from(linkRequestsTable)
    .where(eq(linkRequestsTable.id, requestId))
    .limit(1);

  if (!request) {
    const embed = new EmbedBuilder()
      .setColor(0xff4444)
      .setTitle("❌ Request Not Found")
      .setDescription("This request no longer exists in the database.")
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  if (request.status !== "pending") {
    const embed = new EmbedBuilder()
      .setColor(0xffaa00)
      .setTitle("⚠️ Already Reviewed")
      .setDescription(
        `This request was already **${request.status}** by ${request.reviewedBy}.`
      )
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const disabledApprove = new ButtonBuilder()
    .setCustomId(`approve_${requestId}`)
    .setStyle(ButtonStyle.Success)
    .setDisabled(true);

  const disabledDeny = new ButtonBuilder()
    .setCustomId(`deny_${requestId}`)
    .setStyle(ButtonStyle.Danger)
    .setDisabled(true);

  if (isApprove) {
    const existing = await db
      .select()
      .from(linksTable)
      .where(eq(linksTable.url, request.url))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(linkRequestsTable)
        .set({ status: "approved", reviewedBy: interaction.user.tag })
        .where(eq(linkRequestsTable.id, requestId));

      const embed = new EmbedBuilder()
        .setColor(0xffaa00)
        .setTitle("⚠️ Already Exists")
        .setDescription(`**${request.name}** is already in the link database.`)
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
    } else {
      const filterValues: Record<string, boolean> = {};
      for (const f of FILTERS) {
        filterValues[f.key] = (request as any)[f.key] ?? false;
      }

      await db.insert(linksTable).values({
        name: request.name,
        url: request.url,
        addedBy: `${request.requestedBy} (approved by ${interaction.user.tag})`,
        ...filterValues,
      } as any);

      await db
        .update(linkRequestsTable)
        .set({ status: "approved", reviewedBy: interaction.user.tag })
        .where(eq(linkRequestsTable.id, requestId));

      const bypassingFilters = FILTERS.filter(
        (f) => (request as any)[f.key]
      ).map((f) => f.label);

      const approvedEmbed = new EmbedBuilder()
        .setColor(0x00cc66)
        .setTitle("✅ Request Approved")
        .setDescription(`**${request.name}** has been added to the link database.`)
        .addFields(
          { name: "URL", value: request.url, inline: true },
          {
            name: "Bypasses Filters",
            value:
              bypassingFilters.length > 0
                ? bypassingFilters.join(",\n")
                : "None",
            inline: false,
          },
          {
            name: "Originally Requested By",
            value: request.requestedBy,
            inline: true,
          },
          { name: "Approved By", value: interaction.user.tag, inline: true }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [approvedEmbed] });
    }

    disabledApprove.setLabel("✅ Approved");
    disabledDeny.setLabel("❌ Deny");
  } else {
    await db
      .update(linkRequestsTable)
      .set({ status: "denied", reviewedBy: interaction.user.tag })
      .where(eq(linkRequestsTable.id, requestId));

    const deniedEmbed = new EmbedBuilder()
      .setColor(0xff4444)
      .setTitle("❌ Request Denied")
      .setDescription(`The request for **${request.name}** has been denied.`)
      .addFields(
        { name: "Requested By", value: request.requestedBy, inline: true },
        { name: "Denied By", value: interaction.user.tag, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [deniedEmbed] });

    disabledApprove.setLabel("✅ Approve");
    disabledDeny.setLabel("❌ Denied");
  }

  const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    disabledApprove,
    disabledDeny
  );
  await interaction.message.edit({ components: [disabledRow] });
}

async function handleButton(interaction: ButtonInteraction): Promise<void> {
  const { customId } = interaction;

  if (customId.startsWith("list_page_") || customId.startsWith("link_page_")) {
    await handlePagination(interaction);
    return;
  }

  if (customId.startsWith("approve_") || customId.startsWith("deny_")) {
    await handleApprovalButton(interaction);
    return;
  }
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton()) {
    try {
      await handleButton(interaction);
    } catch (error) {
      console.error("Error handling button:", error);
      const embed = new EmbedBuilder()
        .setColor(0xff4444)
        .setTitle("❌ An error occurred")
        .setDescription("Something went wrong processing this button.")
        .setTimestamp();
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [embed] }).catch(console.error);
      } else {
        await interaction
          .reply({ embeds: [embed], flags: 64 })
          .catch(console.error);
      }
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) {
    console.error(`Unknown command: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing /${interaction.commandName}:`, error);

    const errorEmbed = new EmbedBuilder()
      .setColor(0xff4444)
      .setTitle("❌ An error occurred")
      .setDescription("Something went wrong while executing this command.")
      .setTimestamp();

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ embeds: [errorEmbed] }).catch(console.error);
    } else {
      await interaction
        .reply({ embeds: [errorEmbed], flags: 64 })
        .catch(console.error);
    }
  }
});

client.login(token);
