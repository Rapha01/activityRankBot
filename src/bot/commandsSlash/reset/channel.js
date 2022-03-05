const { MessageActionRow, MessageButton } = require('discord.js');
const resetModel = require('../../models/resetModel.js');


module.exports.execute = async (i) => {
  const cid = i.options.get('channel')?.value || i.options.get('id')?.value;
  if (!cid) {
    return await i.reply({
      content: 'You need to specify either a channel or a channel\'s ID!',
      ephemeral: true,
    });
  }
  if (!i.member.permissionsIn(i.channel).has('MANAGE_GUILD')) {
    return await i.reply({
      content: 'You need the permission to manage the server in order to use this command.',
      ephemeral: true,
    });
  }
  const confirmRow = new MessageActionRow().addComponents(
    new MessageButton()
      .setCustomId('ignore confirm')
      .setLabel('Reset')
      .setEmoji('✅')
      .setStyle('DANGER'),
    new MessageButton()
      .setCustomId('ignore cancel')
      .setLabel('Cancel')
      .setEmoji('❎')
      .setStyle('SECONDARY'),
  );
  const msg = await i.reply({
    content: `Are you sure you want to reset all the statistics of ${await i.client.channels.fetch(cid)}?`,
    ephemeral: true,
    fetchReply: true,
    components: [confirmRow],
  });
  const filter = (interaction) => interaction.user.id === i.user.id;
  try {
    const interaction = msg.awaitMessageComponent({ filter, time: 15_000 });
    if (interaction.customId.split(' ')[1] === 'confirm') {
      resetModel.resetJobs[i.guild.id] = { type: 'guildChannelsStats', ref: i, cmdChannel: i.channel, channelIds: [cid] };
      return interaction.reply({
        content: 'Resetting, please wait...',
        ephemeral: true,
      });
    }
    interaction.reply({
      content: 'Reset cancelled.',
      ephemeral: true,
    });
  } catch (e) {
    if (e.name === 'Error [INTERACTION_COLLECTOR_ERROR]') {
      i.followUp({
        content: 'Action timed out.',
        ephemeral: true,
      });
    } else {
      throw e;
    }
  }
};