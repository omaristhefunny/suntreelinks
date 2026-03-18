import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { FILTERS } from "./filters.js";

export const ITEMS_PER_PAGE = 10;

export type LinkRow = {
  id: number;
  name: string;
  url: string;
  [key: string]: unknown;
};

export function buildLinkPageEmbed(
  results: LinkRow[],
  page: number,
  title: string,
  color: number,
  showFilters: boolean
): EmbedBuilder {
  const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE);
  const start = page * ITEMS_PER_PAGE;
  const slice = results.slice(start, start + ITEMS_PER_PAGE);

  const description = slice
    .map((link, i) => {
      const num = start + i + 1;
      if (showFilters) {
        const bypassing = FILTERS.filter((f) => link[f.key] === true)
          .map((f) => f.label)
          .join(",\n");
        return `**${num}. ${link.name}**\n${link.url}\n*Bypasses: ${bypassing || "None"}*`;
      }
      return `**${num}. ${link.name}**\n${link.url}`;
    })
    .join("\n\n");

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setFooter({
      text: `Page ${page + 1} of ${totalPages} • ${results.length} link${results.length === 1 ? "" : "s"} total`,
    })
    .setTimestamp();
}

export function buildPageButtons(
  prefix: string,
  page: number,
  totalResults: number
): ActionRowBuilder<ButtonBuilder> {
  const totalPages = Math.ceil(totalResults / ITEMS_PER_PAGE);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${prefix}_${page - 1}`)
      .setLabel("◀ Previous")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(`${prefix}_${page + 1}`)
      .setLabel("Next ▶")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1)
  );
}
