import { buildCommand, buildRouteMap } from '@stricli/core';
import { COMMON_CONFIG_FLAGS } from '../../lib/flags';

async function trySnowflake(arg: string) {
  if (/^\d{17,20}$/.test(arg)) {
    return arg;
  } else {
    throw `provided guild ID "${arg}" is not a snowflake`;
  }
}

export const deployProd = buildCommand({
  loader: async () => {
    const { deployProduction } = await import('./deploy');
    return deployProduction;
  },
  parameters: {
    flags: COMMON_CONFIG_FLAGS,
  },
  docs: {
    brief: 'Update Discord production application commands',
  },
});

export const deployDev = buildCommand({
  loader: async () => {
    const { deployDevelopment } = await import('./deploy');
    return deployDevelopment;
  },
  parameters: {
    flags: {
      ...COMMON_CONFIG_FLAGS,
      global: {
        kind: 'boolean',
        brief: 'Whether the commands should be cleared globally.',
      },
    },
    positional: {
      kind: 'array',
      parameter: {
        parse: trySnowflake,
        brief: 'The IDs of guilds to update local commands in.',
        placeholder: 'guilds',
        optional: true,
      },
    },
    aliases: {
      g: 'global',
    },
  },
  docs: {
    brief: 'Update Discord development application commands',
  },
});

const deployRoutes = buildRouteMap({
  routes: {
    production: deployProd,
    development: deployDev,
  },
  docs: {
    brief: 'Push updated commands to Discord',
  },
  aliases: {
    prod: 'production',
    dev: 'development',
  },
});

const clearCmd = buildCommand({
  loader: async () => {
    const { clear } = await import('./clear');
    return clear;
  },
  parameters: {
    flags: {
      ...COMMON_CONFIG_FLAGS,
      global: {
        kind: 'boolean',
        brief: 'Whether the commands should be cleared globally.',
      },
    },
    positional: {
      kind: 'array',
      parameter: {
        parse: trySnowflake,
        brief: 'The IDs of guilds to clear local commands in.',
        placeholder: 'guilds',
        optional: true,
      },
    },
    aliases: {
      g: 'global',
    },
  },
  docs: {
    brief: 'Clear Discord application commands',
  },
});

const listCmd = buildCommand({
  loader: async () => {
    const { list } = await import('./list');
    return list;
  },
  parameters: {
    flags: COMMON_CONFIG_FLAGS,
    positional: {
      kind: 'tuple',
      parameters: [
        {
          parse: trySnowflake,
          placeholder: 'guildId',
          brief: 'The ID of a guild to list local commands in.',
          optional: true,
        },
      ],
    },
  },
  docs: {
    brief: 'List commands currently deployed to Discord',
  },
});

export const commandsRoutes = buildRouteMap({
  routes: {
    deploy: deployRoutes,
    clear: clearCmd,
    list: listCmd,
  },
  docs: {
    brief: "Manage ActivityRank's Discord application commands",
  },
  aliases: {
    d: 'deploy',
    c: 'clear',
  },
});
