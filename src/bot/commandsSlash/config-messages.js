/* eslint-disable max-len */
const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed, MessageActionRow, MessageButton, MessageSelectMenu } = require('discord.js');
const { Modal, TextInputComponent, showModal } = require('discord-modals');
const guildModel = require('../models/guild/guildModel.js');

const generateRows = async (i) => {
  return [
    new MessageActionRow().addComponents(
      new MessageSelectMenu().setCustomId(`commandsSlash/config-messages.js ${i.member.id} select`).setPlaceholder('The message to set')
        .setOptions([
          { label: 'Server Join Message', value: 'serverJoinMessage' },
          { label: 'Levelup Message', value: 'levelupMessage' },
          { label: 'Default Role Assign Message', value: 'roleAssignMessage' },
          { label: 'Default Role Deassign Message', value: 'roleDeasssignMessage' },
        ]),
    ),
    new MessageActionRow().addComponents(
      new MessageButton().setLabel('Clear a message').setStyle('DANGER').setCustomId(`commandsSlash/config-messages.js ${i.member.id} clear`),
    ),
  ];
};

const _prettifyId = {
  serverJoinMessage: 'Server Join Message',
  levelupMessage: 'Levelup Message',
  roleAssignMessage: 'Role Assign Message',
  roleDeasssignMessage: 'Role Deassign Message',
};

const _modal = (type) => new Modal()
  .setCustomId(`commandsSlash/config-messages.js ${type}`)
  .setTitle('Message Selection')
  .addComponents([
    new TextInputComponent()
      .setCustomId('msg-component-1')
      .setLabel(`The ${_prettifyId[type]}`)
      .setStyle('LONG')
      .setMaxLength(type === 'levelupMessage' ? 1000 : 500)
      .setRequired(true),
  ]);


module.exports.data = new SlashCommandBuilder()
  .setName('config-messages')
  .setDescription('Configures the guild\'s autopost messages');

module.exports.execute = async (i) => {
  if (!i.member.permissionsIn(i.channel).has('MANAGE_GUILD')) {
    return await i.reply({
      content: 'You need the permission to manage the server in order to use this command.',
      ephemeral: true,
    });
  }

  const e = new MessageEmbed()
    .setAuthor({ name: 'Server Messages' }).setColor(0x00AE86)
    .addField('Server Join Message',
      'The message to send when a member joins the server')
    .addField('Levelup Message',
      'The message to send when a member gains a level')
    .addField('Role Assign Message',
      'The message to send when a member gains a role, unless overridden')
    .addField('Role Deassign Message',
      'The message to send when a member loses a role, unless overridden');

  await i.reply({
    embeds: [e],
    components: await generateRows(i),
    ephemeral: true,
  });

};

module.exports.component = async (i) => {
  const [, memberId, type] = i.customId.split(' ');

  if (memberId !== i.member.id)
    return await i.reply({ content: 'Sorry, this menu isn\'t for you.', ephemeral: true });

  if (type === 'clear') {
    return await i.reply({
      content: 'Which message do you want to clear?',
      components: [new MessageActionRow().addComponents(
        new MessageSelectMenu().setCustomId(`commandsSlash/config-messages.js ${i.member.id} clear-select`).setPlaceholder('The message to clear')
          .setOptions([
            { label: 'Server Join Message', value: 'serverJoinMessage' },
            { label: 'Levelup Message', value: 'levelupMessage' },
            { label: 'Default Role Assign Message', value: 'roleAssignMessage' },
            { label: 'Default Role Deassign Message', value: 'roleDeasssignMessage' },
          ]),
      )],
      ephemeral: true,
    });
  }

  if (type === 'clear-select') {
    const clearItem = i.values[0];
    await guildModel.storage.set(i.guild, clearItem, '');

    return await i.reply({
      content: `Cleared \`${_prettifyId[clearItem]}\``,
      ephemeral: true,
    });
  }

  if (type === 'select')
    return await showModal(_modal(i.values[0]), { client: i.client, interaction: i });
};

module.exports.modal = async function(i) {
  const [, type] = i.customId.split(' ');
  const value = await i.getTextInputValue('msg-component-1');
  await guildModel.storage.set(i.guild, type, value);

  await i.deferReply({ ephemeral: true });
  await i.followUp({
    content: `Set ${_prettifyId[type]}`,
    embeds: [{ description: value, color: '#4fd6c8' }],
    ephemeral: true,
  });
};
