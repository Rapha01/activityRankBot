import { command } from 'bot/util/registry/command.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { config, isProduction } from 'const/config.js';

export default command.basic({
  data: { name: 'ping' },
  async execute({ interaction, t }) {
    const sent = await interaction.deferReply({ fetchReply: true, ephemeral: true });

    const pingEmbed = new EmbedBuilder()
      .setColor(0x00ae86)
      .setTitle(t('ping.title'))
      .setDescription(isProduction ? null : `**${t('ping.isDev')}**`)
      .addFields(
        {
          name: t('ping.latency.name'),
          value: `\`\`\`${t('ping.latency.value', { time: sent.createdTimestamp - interaction.createdTimestamp })}\`\`\``,
        },
        {
          name: t('ping.heartbeat.name'),
          value:
            interaction.client.ws.ping > 0
              ? `\`\`\`${t('ping.heartbeat.value', { time: Math.round(interaction.client.ws.ping) })}\`\`\``
              : t('ping.heartbeat.empty'),
        },
      )
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Invite the bot')
        .setURL(config.invite.standard)
        .setStyle(ButtonStyle.Link),
    );

    await interaction.editReply({
      embeds: [pingEmbed],
      components: [row],
    });
  },
});
