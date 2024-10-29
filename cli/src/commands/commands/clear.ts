import type { LocalContext } from '../../context.js';
import { getAPI, getConfig } from '../../lib/config.js';
import { confirm } from '@inquirer/prompts';
import ora from 'ora';
import chalk from 'chalk';
import type { CommonConfigFlags } from '../../lib/flags.js';

interface CommandFlags extends CommonConfigFlags {
  global: boolean;
}

export async function clear(
  this: LocalContext,
  flags: CommandFlags,
  ...guildIds: string[] | [undefined]
) {
  const conf = await getConfig({ config: flags.configPath, keys: flags.keysPath });
  const api = getAPI(conf);
  const app = await api.applications.getCurrent();

  const clearLocal = guildIds.length >= 0 && guildIds[0];
  let msg: string;
  if (clearLocal && flags.global) {
    msg = `Are you sure you want to clear all of ${chalk.blue.bold(app.name)}'s commands in guilds ${guildIds.map((id) => `${chalk.green.bold(id)}`).join(', ')} and ${chalk.yellow.bold('all global commands')}?`;
  } else if (clearLocal) {
    msg = `Are you sure you want to clear all of ${chalk.blue.bold(app.name)}'s local commands in guilds ${guildIds.map((id) => `${chalk.green.bold(id)}`).join(', ')}?`;
  } else if (flags.global) {
    msg = `Are you sure you want to clear ${chalk.yellow.bold('all of')} ${chalk.blue.bold(app.name)}'s ${chalk.yellow.bold('global commands')}?`;
  } else {
    throw 'either the --global flag or a guild ID is required.';
  }

  const confirmation = await confirm({ message: msg, default: false });
  if (!confirmation) throw 'cancelled command.';

  const spinner = ora('Deploying commands...').start();
  if (clearLocal) {
    for (const guildId of guildIds) {
      await api.applicationCommands.bulkOverwriteGuildCommands(conf.keys.botId, guildId!, []);
    }
  }
  if (flags.global) {
    await api.applicationCommands.bulkOverwriteGlobalCommands(conf.keys.botId, []);
  }
  spinner.succeed('Successfully cleared commands.');
}
