import { Client, Options, GatewayIntentBits, Partials, type GuildMember } from 'discord.js';
import fct from '../util/fct.js';
import loggerManager from './util/logger.js';
import globalLogger from '../util/logger.js';
import { ActivityType } from 'discord.js';
import { updateTexts } from 'models/managerDb/textModel.js';
import { memberCache } from './models/guild/guildMemberModel.js';
import { Time } from '@sapphire/duration';
import { registry } from './util/registry/registry.js';
import { ensureI18nLoaded } from './util/i18n.js';

const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMembers,
  // FLAGS.GUILD_BANS,
  // FLAGS.GUILD_EMOJIS_AND_STICKERS,
  // GatewayIntentBits.GuildIntegrations,
  // FLAGS.GUILD_WEBHOOKS,
  GatewayIntentBits.GuildVoiceStates,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildMessageReactions,
  // FLAGS.GUILD_MESSAGE_TYPING,
  // FLAGS.DIRECT_MESSAGES,
  // FLAGS.DIRECT_MESSAGE_REACTIONS,
  // FLAGS.DIRECT_MESSAGE_TYPING,
];

const sweepers = {
  ...Options.DefaultSweeperSettings,
  messages: {
    interval: 300, // 5m
    lifetime: 600, // 10m
  },
  invites: {
    interval: 300, // 5m
    lifetime: 600, // 10m
  },
};

/**
 * Decide whether or not a member should be kept cached.
 * @param member the member to check if it will be kept cached
 * @returns whether the member needs to remain cached.
 */
function keepMemberCached(member: GuildMember): boolean {
  if (member.id === member.client.user.id) return true; // keep own client cached
  if (member.voice.channelId !== null) return true; // keep users in voice cached so they can be counted

  const lastVoteDate = memberCache.get(member)?.cache.lastVoteDate;
  // Keep users that have voted in the last week so that they can't vote multiple times.
  // We don't check how long the guild's vote timeout is here, or even whether the guild permits votes,
  // because it would slow down the bot too much and the memory optimisation would be negligible at that point.
  if (lastVoteDate && lastVoteDate.getTime() > Date.now() - Time.Week) return true;
  return false;
}

const client = new Client({
  intents,
  presence: {
    activities: [
      {
        type: ActivityType.Custom,
        // `state` is what actually gets displayed;
        // `name` is still required but not shown
        state: 'Calculating..',
        name: 'Calculating..',
      },
    ],
  },
  makeCache: Options.cacheWithLimits({
    ...Options.DefaultMakeCacheSettings,
    ApplicationCommandManager: 0,
    AutoModerationRuleManager: 0,
    BaseGuildEmojiManager: 0,
    DMMessageManager: 0,
    GuildBanManager: 0,
    GuildEmojiManager: 0,
    GuildInviteManager: 0,
    PresenceManager: 0,
    GuildScheduledEventManager: 0,
    GuildStickerManager: 0,
    ReactionManager: 0,
    ReactionUserManager: 0,
    GuildMemberManager: { maxSize: 200, keepOverLimit: keepMemberCached },
  }),
  sweepers: {
    ...Options.DefaultSweeperSettings,
    users: {
      interval: 3_600, // Every hour.
      filter: () => (user) => user.bot && user.id !== user.client.user.id, // Remove all bots.
    },
  },
  // Message and Reaction partials are required to listen for reactions on uncached messages (for reactionVotes).
  partials: [Partials.Message, Partials.Reaction],
});

// Adjusts number of threads allocated by libuv
// @ts-expect-error process.env only expects string values
process.env.UV_THREADPOOL_SIZE = 50;

start();

async function start() {
  try {
    client.logger = loggerManager.init(client.shard!.ids);
    client.logger.info('Initialising...');

    await ensureI18nLoaded();
    await initClientCaches(client);

    client.logger.info('Loading pieces...');

    await registry.loadEvents();
    client.logger.info(`Loaded ${registry.events.size} events`);
    registry.attachEvents(client);

    await registry.loadCommands();
    client.logger.info(`Loaded ${registry.commands.size} commands`);

    client.logger.info('Logging in...');
    await client.login();
    client.logger.info('Initialized');
  } catch (e) {
    globalLogger.warn(e, 'Error while launching shard');
    await fct.waitAndReboot(3_000);
  }
}

async function initClientCaches(client: Client) {
  // statFlushCache cannot be a Map because it's fetched by the manager
  // (which only accepts JSON-serializable objects)
  client.statFlushCache = {};
  client.xpFlushCache = {};
  client.botShardStat = { commandsTotal: 0, textMessagesTotal: 0 };
  await updateTexts();
}

process.on('SIGINT', () => {
  globalLogger.warn('SIGINT signal received in Shard.');
  process.exit();
});

process.on('SIGTERM', () => {
  globalLogger.warn('SIGTERM signal received in Shard.');
  process.exit();
});
