import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from 'discord.js';
import { stripIndent } from 'common-tags';
import type { TextsCommands, TextsEntry } from 'models/types/external.js';
import { getTexts } from 'models/managerDb/textModel.js';
import { config, version } from 'const/config.js';
import { command } from 'bot/util/registry/command.js';
import { component } from 'bot/util/registry/component.js';
import { requireUser } from 'bot/util/predicates.js';

export default command.basic({
  data: {
    name: 'help',
    description: 'Show information for operating the bot',
  },
  async execute({ interaction }) {
    const { commands } = await getTexts();
    const helpEmbed = helpMainEmbed(commands);
    await interaction.reply({
      embeds: [helpEmbed],
      components: [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(select.instanceId({ predicate: requireUser(interaction.user) }))
            .setPlaceholder('Nothing selected')
            .addOptions([
              { label: 'Server Statistics', value: 'stats' },
              { label: 'Voting and Inviting', value: 'voting' },
              { label: 'Configuration Info', value: 'info' },
              { label: 'Personal Settings', value: 'mysettings' },
              { label: 'FAQ and Patchnotes', value: 'other' },
              { label: 'Server Settings', value: 'serverSettings' },
              { label: 'XP Settings', value: 'xpSettings' },
              { label: 'Bonus XP', value: 'bonusxp' },
              { label: 'Role autoassignments', value: 'roleAssignments' },
              { label: 'Resets', value: 'reset' },
            ] satisfies { label: string; value: keyof TextsCommands }[]),
        ),
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(close.instanceId({ predicate: requireUser(interaction.user) }))
            .setLabel('Close')
            .setStyle(ButtonStyle.Danger),
        ),
      ],
    });
  },
});

const select = component({
  type: ComponentType.StringSelect,
  async callback({ interaction }) {
    const { commands } = await getTexts();

    const key = interaction.values[0] as keyof TextsCommands;
    const embed = helpFeatureEmbed(commands[key]);

    await interaction.update({ embeds: [embed] });
  },
});

const close = component({
  type: ComponentType.Button,
  async callback({ interaction, drop }) {
    await interaction.deferUpdate();
    await interaction.deleteReply();
    drop();
  },
});

function helpMainEmbed(sections: TextsCommands) {
  const embed = new EmbedBuilder().setAuthor({ name: 'ActivityRank Manual' }).setColor(0x00ae86)
    .setDescription(stripIndent`
      *v${version}*
      **[Website](https://activityrank.me/commands)**
      **[Support Server](${config.supportServer.invite})**
      By using this bot you accept the **[terms and conditions](https://activityrank.me/termsandconditions)**.`);

  for (const _command in sections) {
    const command = _command as keyof TextsCommands;
    embed.addFields({
      name: `***${sections[command].title}***`,
      value: sections[command].desc,
    });
  }

  return embed;
}

function helpFeatureEmbed(section: TextsEntry) {
  const embed = new EmbedBuilder()
    .setColor(0x00ae86)
    .setTitle(`**Manual - ${section.title}**`)
    .setDescription(section.subdesc);

  for (const command of section.subcommands) {
    embed.addFields({
      name: `${command.title}\n${command.command}`,
      value: `${command.desc}\nex.: \`\`${command.example}\`\``,
    });
  }
  return embed;
}
