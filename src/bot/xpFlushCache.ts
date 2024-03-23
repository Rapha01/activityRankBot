import type { Guild, GuildMember } from 'discord.js';
import guildModel from './models/guild/guildModel.js';

export async function addXp(member: GuildMember, xp: number) {
  const key = `${member.guild.id}.${member.id}`;
  let bonusCache = await buildXpFlushCache(member.guild);

  let entry = bonusCache[key];
  if (!entry) entry = { guildId: member.guild.id, userId: member.id, count: xp };
  else entry.count += xp;
}

const buildXpFlushCache = async (guild: Guild) => {
  const { dbHost } = await guildModel.cache.get(guild);
  const { xpFlushCache } = guild.client;

  if (!Object.keys(xpFlushCache).includes(dbHost)) xpFlushCache[dbHost] = {};

  return xpFlushCache[dbHost]!;
};

export type XpFlushCache = Record<string, { guildId: string; userId: string; count: number }>;
