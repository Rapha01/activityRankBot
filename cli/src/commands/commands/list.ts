import type { LocalContext } from '../../context.js';
import { getAPI, getConfig } from '../../lib/config.js';
import treeify from 'object-treeify';
import chalk from 'chalk';
import type { CommonConfigFlags } from '../../lib/flags.js';
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  type APIApplicationCommandOption,
} from 'discord.js';
import type { API } from '@discordjs/core';
import ora from 'ora';

interface CommandFlags extends CommonConfigFlags {}

export async function list(this: LocalContext, flags: CommandFlags, guildId?: string) {
  const conf = await getConfig({ config: flags.configPath, keys: flags.keysPath });
  const api = getAPI(conf);

  const spinner = ora('Fetching commands...').start();

  const app = await api.applications.getCurrent();
  const globalCommands = await api.applicationCommands.getGlobalCommands(conf.keys.botId);
  const globalTree = Object.fromEntries(globalCommands.map((command) => produceSubtree(command)));

  const selectedId = guildId ?? conf.config.developmentServers.at(0);
  const summary = selectedId
    ? await fetchGuildCommandSummary(selectedId, conf.keys.botId, api)
    : null;

  spinner.succeed('Fetched commands');

  console.log(`Command informaton for ${app.name}`);
  console.log(`${chalk.bold('Global commands')}: [${chalk.blue(globalCommands.length)}]`);
  console.log(treeify(globalTree));
  if (summary) {
    console.log(
      `${chalk.bold('Guild')} [${chalk.blue(selectedId)}] ${chalk.bold('commands')}: [${chalk.blue(summary.size)}]`,
    );
    console.log(summary.tree);
  }
}

export async function fetchGuildCommandSummary(
  guildId: string,
  clientId: string,
  api: API,
): Promise<{ tree: string; size: number }> {
  const guildCommands = await api.applicationCommands.getGuildCommands(clientId, guildId);

  const localTree = Object.fromEntries(guildCommands.map((command) => produceSubtree(command)));
  return { size: guildCommands.length, tree: treeify(localTree) };
}

interface SubtreeParent {
  name: string;
  options?: APIApplicationCommandOption[];
  type?: ApplicationCommandType | ApplicationCommandOptionType;
}

function produceSubtree(command: SubtreeParent, parent = ''): [string, unknown] {
  let name = parent === '' ? command.name : `${parent} ${command.name}`;
  // mark context menu commands
  if (parent === '' && command.type !== ApplicationCommandType.ChatInput)
    name = chalk.blue('[C] ') + name;

  if (!command.options || command.options.length <= 0) return [name, null];
  const subcommands = command.options.filter(
    (opt) =>
      opt.type === ApplicationCommandOptionType.Subcommand ||
      opt.type === ApplicationCommandOptionType.SubcommandGroup,
  );
  if (subcommands.length <= 0) return [name, null];

  return [name, Object.fromEntries(subcommands.map((sc) => produceSubtree(sc, name)))];
}
