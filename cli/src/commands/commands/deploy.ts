import type { LocalContext } from '../../context.js';
import type { RESTPutAPIApplicationGuildCommandsJSONBody } from '@discordjs/core';
import { getAPI, getConfig, getRegistry, SNOWFLAKE_SCHEMA } from '../../lib/config.js';
import { z } from 'zod';
import { confirm, select } from '@inquirer/prompts';
import ora from 'ora';
import chalk from 'chalk';
import type { CommonConfigFlags } from '../../lib/flags.js';

interface ProductionCommandFlags extends CommonConfigFlags {}

export async function deployProduction(this: LocalContext, flags: ProductionCommandFlags) {
  const conf = await getConfig({ config: flags.configPath, keys: flags.keysPath });
  const api = getAPI(conf);
  const app = await api.applications.getCurrent();

  const confirmation = await confirm({
    message: `Are you sure that ${chalk.blue.bold(app.name)} is the production bot?`,
    default: false,
  });
  if (!confirmation) throw `check the credentials in your keyfile: ${flags.keysPath}`;

  const registry = await getRegistry();

  const type: 'GLOBAL' | 'ADMIN' = await select({
    message: 'You are deploying with production credentials. How would you like to deploy?',
    choices: [
      { name: 'Update globally deployed commands', value: 'GLOBAL' },
      { name: 'Update administrative commands', value: 'ADMIN' },
    ],
  });

  const spinner = ora('Deploying commands...').start();
  let response: string;
  if (type === 'GLOBAL') {
    const globalCommands: RESTPutAPIApplicationGuildCommandsJSONBody = [];

    for (const command of registry.commands.values()) {
      if (command.deploymentMode === 'GLOBAL') {
        globalCommands.push(command.data);
      }
    }
    await api.applicationCommands.bulkOverwriteGlobalCommands(conf.keys.botId, globalCommands);
    response = `Successfully deployed ${globalCommands.length} commands to production.`;
  } else if (type === 'ADMIN') {
    const localCommands: RESTPutAPIApplicationGuildCommandsJSONBody = [];

    for (const command of registry.commands.values()) {
      if (command.deploymentMode === 'LOCAL_ONLY') {
        localCommands.push(command.data);
      }
    }

    for (const guild of conf.config.developmentServers) {
      await api.applicationCommands.bulkOverwriteGuildCommands(
        conf.keys.botId,
        guild,
        localCommands,
      );
    }

    response = `Successfully deployed ${localCommands.length} administrative commands to ${conf.config.developmentServers.length} production servers.`;
  } else {
    throw new Error('Unreachable invariant');
  }
  spinner.succeed(response);
}

interface DevelopmentCommandFlags extends CommonConfigFlags {
  global: boolean;
}

export async function deployDevelopment(
  this: LocalContext,
  flags: DevelopmentCommandFlags,
  ...devGuilds: string[] | undefined[]
) {
  const overrideGuilds = devGuilds.length > 0 && devGuilds[0];
  const conf = await getConfig({ config: flags.configPath, keys: flags.keysPath });
  const api = getAPI(conf);

  const guilds = overrideGuilds
    ? z.array(SNOWFLAKE_SCHEMA).parse(devGuilds)
    : conf.config.developmentServers;

  const registry = await getRegistry();
  const localCommands: RESTPutAPIApplicationGuildCommandsJSONBody = [];
  const globalCommands: RESTPutAPIApplicationGuildCommandsJSONBody = [];

  for (const command of registry.commands.values()) {
    if (command.deploymentMode === 'GLOBAL') {
      globalCommands.push(command.data);
    } else if (command.deploymentMode === 'LOCAL_ONLY') {
      localCommands.push(command.data);
    }
  }
  if (flags.global) {
    console.log(
      chalk.red(
        `\nAre you sure you want to deploy ${globalCommands.length} commands globally?\nThis is a development command; you may have meant "ar commands deploy production"\ninstead of the "--global" flag.\n`,
      ),
    );
    const confirmation = await confirm({
      message: 'Continue to deploy globally?',
      default: false,
    });

    if (confirmation) {
      const spinner = ora('Deploying commands...').start();
      await api.applicationCommands.bulkOverwriteGlobalCommands(conf.keys.botId, globalCommands);
      spinner.succeed(
        `Wrote ${globalCommands.length} commands globally. Commands that were not permitted to be deployed globally have been ignored.`,
      );
    }
  } else {
    const spinner = ora('Deploying commands...').start();
    for (const guild of guilds) {
      await api.applicationCommands.bulkOverwriteGuildCommands(conf.keys.botId, guild, [
        ...localCommands,
        ...globalCommands,
      ]);
    }
    spinner.succeed(
      `Wrote ${localCommands.length + globalCommands.length} commands to ${guilds.length} guilds.`,
    );
  }
}
