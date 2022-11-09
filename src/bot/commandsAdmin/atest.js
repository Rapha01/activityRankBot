const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed, Permissions: { FLAGS } } = require('discord.js');
const { PRIVILEGE_LEVELS } = require('../../const/privilegedUsers');

module.exports.requiredPrivileges = PRIVILEGE_LEVELS.HelpStaff;

module.exports.data = new SlashCommandBuilder()
  .setName('atest')
  .setDescription('A test admin command.')
  .setDefaultMemberPermissions(FLAGS.BAN_MEMBERS);

module.exports.execute = async function(i) {
  const sent = await i.deferReply({ fetchReply: true, ephemeral: true });
  const pingEmbed = new MessageEmbed()
    .setColor(0x00AE86)
    .setTitle('🏓 Pong! 🏓')
    .addFields(
      { name: '🔁 Roundtrip Latency 🔁', value: `\`\`\`${sent.createdTimestamp - i.createdTimestamp}ms\`\`\`` },
      { name: '💗 API Heartbeat 💗', value: `\`\`\`${Math.round(i.client.ws.ping)}ms\`\`\`` },
    )
    .setTimestamp();
  await i.editReply({ embeds: [pingEmbed], ephemeral: true });
};