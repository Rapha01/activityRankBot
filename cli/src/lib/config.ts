import { readFile } from 'fs/promises';
import { $ } from 'execa';
import { z } from 'zod';
import { API } from '@discordjs/core';
import { REST } from '@discordjs/rest';
import ora from 'ora';

export const SNOWFLAKE_SCHEMA = z.string().regex(/^\d{17,20}$/);

process.env['LOAD_LOCAL_CONFIG'] = '1';

const CONFIG_SCHEMA = z.object({
  developmentServers: z.array(SNOWFLAKE_SCHEMA),
});

const KEYS_SCHEMA = z.object({
  botAuth: z.string().min(1),
  botId: SNOWFLAKE_SCHEMA,
});

interface ConfigPaths {
  config: string;
  keys: string;
}

/**
 * Load and parse the configuration from a set of optionally provided config paths.
 * @param paths A set of configuration paths to load.
 * @returns A set of validated configuration objects
 */
export async function getConfig(paths: ConfigPaths) {
  const configFile = await readFile(paths.config);
  const config = JSON.parse(configFile.toString());

  const keyFile = await readFile(paths.keys);
  const keys = JSON.parse(keyFile.toString());

  return {
    config: CONFIG_SCHEMA.parse(config),
    keys: KEYS_SCHEMA.parse(keys),
  };
}

/**
 * Create a new API interface.
 * @param conf a configuration object
 */
export function getAPI(conf: Awaited<ReturnType<typeof getConfig>>) {
  const rest = new REST();
  rest.setToken(conf.keys.botAuth);

  return new API(rest);
}

export async function getRegistry() {
  const spinner = ora('Building dist folder...').start();
  await $`npm run build`;
  spinner.succeed('Built JS dist');

  const spinner2 = ora('Loading commands...').start();

  // silence ExperimentalWarning: Importing JSON modules is an experimental feature
  const originalEmit = process.emit;
  // @ts-expect-error
  process.emit = function (name, ...args: [unknown]) {
    if (
      name === 'warning' &&
      typeof args[0] === 'object' &&
      args[0] instanceof Error &&
      args[0].name === 'ExperimentalWarning' &&
      args[0].message.includes('Importing JSON modules is an experimental feature')
    ) {
      return false;
    }
    // @ts-expect-error
    return originalEmit.apply(process, [name, ...args]);
  };

  const { createRegistryCLI } = await import(
    new URL('../../dist/bot/util/registry/registry.js', import.meta.url).toString()
  );
  const registry = await createRegistryCLI();
  await registry.loadCommands();
  spinner2.succeed(`Loaded ${registry.commands.size} commands`);

  return registry;
}
