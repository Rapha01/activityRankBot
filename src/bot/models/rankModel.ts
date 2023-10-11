import shardDb from '../../models/shardDb/shardDb.js';
import fct from '../../util/fct.js';
import type { Guild } from 'discord.js';
import type { StatTimeInterval, StatType } from 'models/types/enums.js';

// Toplist
export const getGuildMemberRanks = async function <T extends StatTimeInterval>(
  guild: Guild,
  type: StatType | 'totalScore',
  time: T,
  from: number,
  to: number,
) {
  const memberRanksSql = `
    SELECT * FROM ${getGuildMemberRanksSql(guild)} AS memberranks
    ORDER BY ${type + time} DESC 
    LIMIT ${from - 1},${to - (from - 1)}`;

  type RankResult = Record<`${StatType | 'totalScore'}${StatTimeInterval}`, number> & {
    userId: string;
  };

  const ranks = await shardDb.query<RankResult[]>(guild.appData.dbHost, memberRanksSql);

  return ranks.map((r) => ({
    ...r,
    levelProgression: fct.getLevelProgression(r.totalScoreAlltime, guild.appData.levelFactor),
  }));
};

// All scores for one member
export const getGuildMemberRank = async function (guild: Guild, userId: string) {
  const res = await shardDb.query<
    Record<`${StatType | 'totalScore'}${StatTimeInterval}`, number>[]
  >(guild.appData.dbHost, `SELECT * FROM ${getGuildMemberRankSql(guild, userId)} AS memberrank`);

  if (res.length == 0) return null;

  return res[0];
};

// Positions of one type of one member within a guild
export const getGuildMemberRankPosition = async function (
  guild: Guild,
  userId: string,
  typeTime: string,
) {
  const res = await shardDb.query<{ count: number }[]>(
    guild.appData.dbHost,
    `SELECT (COUNT(*) + 1) AS count FROM ${getGuildMemberRanksSql(guild)}
      AS memberranks WHERE memberranks.${typeTime} >
      (SELECT ${typeTime} FROM ${getGuildMemberRankSql(guild, userId)} AS alias2)`,
  );

  if (res.length == 0) return null;

  return res[0].count;
};

// Most active channels within a guild
export const getChannelRanks = async function <T extends StatTimeInterval>(
  guild: Guild,
  type: 'voiceMinute' | 'textMessage',
  time: T,
  from: number,
  to: number,
) {
  const ranks = await shardDb.query<({ channelId: string } & Record<T, number>)[]>(
    guild.appData.dbHost,
    `SELECT channelId,
    SUM(${time}) AS ${time} FROM ${type}
    WHERE guildId = ${guild.id} AND alltime != 0 GROUP BY channelId
    ORDER BY ${time} DESC LIMIT ${from - 1},${to - (from - 1)}`,
  );
  return ranks;
};

// Most active Members of a specific channel
export const getChannelMemberRanks = async <T extends StatTimeInterval>(
  guild: Guild,
  channelId: string,
  type: StatType,
  time: T,
  from: number,
  to: number,
) => {
  const ranks = await shardDb.query<({ userId: string } & Record<T, number>)[]>(
    guild.appData.dbHost,
    `SELECT userId,${time} FROM ${type}
          WHERE guildId = ${guild.id} AND channelId = ${channelId} AND alltime != 0
          ORDER BY ${time} DESC 
          LIMIT ${from - 1},${to - (from - 1)}`,
  );
  return ranks;
};

// Most active channels of a certain member
export const getGuildMemberTopChannels = async function <T extends StatTimeInterval>(
  guild: Guild,
  userId: string,
  type: StatType,
  time: T,
  from: number,
  to: number,
) {
  const res = await shardDb.query<({ channelId: string } & Record<T, number>)[]>(
    guild.appData.dbHost,
    `SELECT channelId,${time} FROM ${type}
          WHERE guildId = ${guild.id} AND userId = ${userId} AND ${time} != 0
          ORDER BY ${time} DESC
          LIMIT ${from - 1},${to - (from - 1)}`,
  );

  if (res.length == 0) return null;

  return res;
};

export const countGuildRanks = async function (guild: Guild) {
  const res = await shardDb.query<{ count: number }[]>(
    guild.appData.dbHost,
    `SELECT COUNT(*) AS count FROM ${getGuildMemberRanksSql(guild)} AS alias1`,
  );
  return res[0].count;
};

export const getGuildMemberTotalScore = async function (guild: Guild, userId: string) {
  const res = await shardDb.query<{ totalScoreAlltime: number }[]>(
    guild.appData.dbHost,
    `${getGuildMemberTotalScoreSql(guild, userId)}`,
  );

  if (res.length == 0) return null;

  return res[0].totalScoreAlltime;
};

/* exports.getRankedGuildMemberIds = function(guildId) {
  return new Promise(async function (resolve, reject) {
    db.query(`(SELECT userId FROM voiceMinute WHERE guildId = '${guildId}' AND alltime != 0)
        UNION (SELECT userId FROM textMessage WHERE guildId = '${guildId}' AND alltime != 0)
        UNION (SELECT userId FROM vote WHERE guildId = '${guildId}' AND alltime != 0)
        UNION (SELECT userId FROM bonus WHERE guildId = '${guildId}' AND alltime != 0)`,
      function (err, results, fields) {
      if (err) return reject(err);

      return resolve(results);
    });
  });
} */

function getGuildMemberTotalScoreSql(guild: Guild, userId: string) {
  const voicerankSql = `(SELECT userId,
        SUM(alltime) AS voiceMinuteAlltime
        FROM voiceMinute WHERE guildId = ${guild.id} AND userId = ${userId} AND alltime != 0
        GROUP BY userId) AS voicerank`;
  const textrankSql = `(SELECT userId,
        SUM(alltime) AS textMessageAlltime
        FROM textMessage WHERE guildId = ${guild.id} AND userId = ${userId} AND alltime != 0
        GROUP BY userId) AS textrank`;
  const voterankSql = `(SELECT userId,
        alltime AS voteAlltime
        FROM vote WHERE guildId = ${guild.id} AND userId = ${userId} AND alltime != 0) AS voterank`;
  const inviterankSql = `(SELECT userId,
        alltime AS inviteAlltime
        FROM invite WHERE guildId = ${guild.id} AND userId = ${userId} AND alltime != 0) AS inviterank`;
  const bonusrankSql = `(SELECT userId,
        alltime AS bonusAlltime
        FROM bonus WHERE guildId = ${guild.id} AND userId = ${userId} AND alltime != 0) AS bonusrank`;
  const memberIdSql = `(SELECT ${userId} AS userId) AS userIds`;

  const memberRankRawSql = `(SELECT
      userIds.userId AS userId,
      IFNULL(voiceMinuteAlltime,0) * ${guild.appData.xpPerVoiceMinute} AS voiceMinuteScoreAlltime,
      IFNULL(textMessageAlltime,0) * ${guild.appData.xpPerTextMessage} AS textMessageScoreAlltime,
      IFNULL(voteAlltime,0) * ${guild.appData.xpPerVote} AS voteScoreAlltime,
      IFNULL(inviteAlltime,0) * ${guild.appData.xpPerInvite} AS inviteScoreAlltime,
      IFNULL(bonusAlltime,0) AS bonusScoreAlltime
      FROM ${memberIdSql}
      LEFT JOIN ${voicerankSql} ON userIds.userId = voicerank.userId
      LEFT JOIN ${textrankSql} ON userIds.userId = textrank.userId
      LEFT JOIN ${voterankSql} ON userIds.userId = voterank.userId
      LEFT JOIN ${inviterankSql} ON userIds.userId = inviterank.userId
      LEFT JOIN ${bonusrankSql} ON userIds.userId = bonusrank.userId) AS memberrankraw`;

  const memberTotalScoreAlltimeSql = `SELECT (voiceMinuteScoreAlltime + textMessageScoreAlltime + voteScoreAlltime + inviteScoreAlltime + bonusScoreAlltime) AS totalScoreAlltime FROM ${memberRankRawSql}`;

  return memberTotalScoreAlltimeSql;
}

function getGuildMemberRanksSql(guild: Guild) {
  const voiceranksSql = `(SELECT userId,
      SUM(alltime) AS voiceMinuteAlltime,
      SUM(year) AS voiceMinuteYear,
      SUM(month) AS voiceMinuteMonth,
      SUM(week) AS voiceMinuteWeek,
      SUM(day) AS voiceMinuteDay
      FROM voiceMinute WHERE guildId = ${guild.id} AND alltime != 0
      GROUP BY userId) AS voiceranks`;
  const textranksSql = `(SELECT userId,
      SUM(alltime) AS textMessageAlltime,
      SUM(year) AS textMessageYear,
      SUM(month) AS textMessageMonth,
      SUM(week) AS textMessageWeek,
      SUM(day) AS textMessageDay
      FROM textMessage WHERE guildId = ${guild.id} AND alltime != 0
      GROUP BY userId) AS textranks`;
  const voteranksSql = `(SELECT userId,
      alltime AS voteAlltime,
      year AS voteYear,
      month AS voteMonth,
      week AS voteWeek,
      day AS voteDay
      FROM vote WHERE guildId = ${guild.id} AND alltime != 0) AS voteranks`;
  const inviteranksSql = `(SELECT userId,
      alltime AS inviteAlltime,
      year AS inviteYear,
      month AS inviteMonth,
      week AS inviteWeek,
      day AS inviteDay
      FROM invite WHERE guildId = ${guild.id} AND alltime != 0) AS inviteranks`;
  const bonusranksSql = `(SELECT userId,
      alltime AS bonusAlltime,
      year AS bonusYear,
      month AS bonusMonth,
      week AS bonusWeek,
      day AS bonusDay
      FROM bonus WHERE guildId = ${guild.id} AND alltime != 0) AS bonusranks`;
  const memberIdsSql = `((SELECT userId FROM voiceMinute WHERE guildId = ${guild.id} AND alltime != 0)
      UNION (SELECT userId FROM textMessage WHERE guildId = ${guild.id} AND alltime != 0)
      UNION (SELECT userId FROM vote WHERE guildId = ${guild.id} AND alltime != 0)
      UNION (SELECT userId FROM bonus WHERE guildId = ${guild.id} AND alltime != 0)) AS userIds`;

  const memberRanksRawSql = `(SELECT
      userIds.userId AS userId,
      IFNULL(voiceMinuteAlltime,0) * ${guild.appData.xpPerVoiceMinute} AS voiceMinuteScoreAlltime,
      IFNULL(voiceMinuteYear,0) * ${guild.appData.xpPerVoiceMinute} AS voiceMinuteScoreYear,
      IFNULL(voiceMinuteMonth,0) * ${guild.appData.xpPerVoiceMinute} AS voiceMinuteScoreMonth,
      IFNULL(voiceMinuteWeek,0) * ${guild.appData.xpPerVoiceMinute} AS voiceMinuteScoreWeek,
      IFNULL(voiceMinuteDay,0) * ${guild.appData.xpPerVoiceMinute} AS voiceMinuteScoreDay,
      IFNULL(textMessageAlltime,0) * ${guild.appData.xpPerTextMessage} AS textMessageScoreAlltime,
      IFNULL(textMessageYear,0) * ${guild.appData.xpPerTextMessage} AS textMessageScoreYear,
      IFNULL(textMessageMonth,0) * ${guild.appData.xpPerTextMessage} AS textMessageScoreMonth,
      IFNULL(textMessageWeek,0) * ${guild.appData.xpPerTextMessage} AS textMessageScoreWeek,
      IFNULL(textMessageDay,0) * ${guild.appData.xpPerTextMessage} AS textMessageScoreDay,
      IFNULL(voteAlltime,0) * ${guild.appData.xpPerVote} AS voteScoreAlltime,
      IFNULL(voteYear,0) * ${guild.appData.xpPerVote} AS voteScoreYear,
      IFNULL(voteMonth,0) * ${guild.appData.xpPerVote} AS voteScoreMonth,
      IFNULL(voteWeek,0) * ${guild.appData.xpPerVote} AS voteScoreWeek,
      IFNULL(voteDay,0) * ${guild.appData.xpPerVote} AS voteScoreDay,
      IFNULL(inviteAlltime,0) * ${guild.appData.xpPerInvite} AS inviteScoreAlltime,
      IFNULL(inviteYear,0) * ${guild.appData.xpPerInvite} AS inviteScoreYear,
      IFNULL(inviteMonth,0) * ${guild.appData.xpPerInvite} AS inviteScoreMonth,
      IFNULL(inviteWeek,0) * ${guild.appData.xpPerInvite} AS inviteScoreWeek,
      IFNULL(inviteDay,0) * ${guild.appData.xpPerInvite} AS inviteScoreDay,
      IFNULL(bonusAlltime,0) * ${guild.appData.xpPerBonus} AS bonusScoreAlltime,
      IFNULL(bonusYear,0) * ${guild.appData.xpPerBonus} AS bonusScoreYear,
      IFNULL(bonusMonth,0) * ${guild.appData.xpPerBonus} AS bonusScoreMonth,
      IFNULL(bonusWeek,0) * ${guild.appData.xpPerBonus} AS bonusScoreWeek,
      IFNULL(bonusDay,0) * ${guild.appData.xpPerBonus} AS bonusScoreDay,
      IFNULL(voiceMinuteAlltime,0) AS voiceMinuteAlltime,
      IFNULL(voiceMinuteYear,0) AS voiceMinuteYear,
      IFNULL(voiceMinuteMonth,0) AS voiceMinuteMonth,
      IFNULL(voiceMinuteWeek,0) AS voiceMinuteWeek,
      IFNULL(voiceMinuteDay,0) AS voiceMinuteDay,
      IFNULL(textMessageAlltime,0) AS textMessageAlltime,
      IFNULL(textMessageYear,0) AS textMessageYear,
      IFNULL(textMessageMonth,0) AS textMessageMonth,
      IFNULL(textMessageWeek,0) AS textMessageWeek,
      IFNULL(textMessageDay,0) AS textMessageDay,
      IFNULL(voteAlltime,0) AS voteAlltime,
      IFNULL(voteYear,0) AS voteYear,
      IFNULL(voteMonth,0) AS voteMonth,
      IFNULL(voteWeek,0) AS voteWeek,
      IFNULL(voteDay,0) AS voteDay,
      IFNULL(inviteAlltime,0) AS inviteAlltime,
      IFNULL(inviteYear,0) AS inviteYear,
      IFNULL(inviteMonth,0) AS inviteMonth,
      IFNULL(inviteWeek,0) AS inviteWeek,
      IFNULL(inviteDay,0) AS inviteDay,
      IFNULL(bonusAlltime,0) AS bonusAlltime,
      IFNULL(bonusYear,0) AS bonusYear,
      IFNULL(bonusMonth,0) AS bonusMonth,
      IFNULL(bonusWeek,0) AS bonusWeek,
      IFNULL(bonusDay,0) AS bonusDay
      FROM ${memberIdsSql}
      LEFT JOIN ${voiceranksSql} ON userIds.userId = voiceranks.userId
      LEFT JOIN ${textranksSql} ON userIds.userId = textranks.userId
      LEFT JOIN ${voteranksSql} ON userIds.userId = voteranks.userId
      LEFT JOIN ${inviteranksSql} ON userIds.userId = inviteranks.userId
      LEFT JOIN ${bonusranksSql} ON userIds.userId = bonusranks.userId) AS memberranksraw`;

  const memberRanksSql = `(SELECT memberranksraw.*,
      (voiceMinuteScoreAlltime + textMessageScoreAlltime + voteScoreAlltime + inviteScoreAlltime + bonusScoreAlltime) AS totalScoreAlltime,
      (voiceMinuteScoreYear + textMessageScoreYear + voteScoreYear + inviteScoreYear + bonusScoreYear) AS totalScoreYear,
      (voiceMinuteScoreMonth + textMessageScoreMonth + voteScoreMonth + inviteScoreMonth + bonusScoreMonth) AS totalScoreMonth,
      (voiceMinuteScoreWeek + textMessageScoreWeek + voteScoreWeek + inviteScoreWeek + bonusScoreWeek) AS totalScoreWeek,
      (voiceMinuteScoreDay + textMessageScoreDay + voteScoreDay + inviteScoreDay + bonusScoreDay) AS totalScoreDay FROM ${memberRanksRawSql})`;

  return memberRanksSql;
}

function getGuildMemberRankSql(guild: Guild, userId: string) {
  const voicerankSql = `(SELECT userId,
        SUM(alltime) AS voiceMinuteAlltime,
        SUM(year) AS voiceMinuteYear,
        SUM(month) AS voiceMinuteMonth,
        SUM(week) AS voiceMinuteWeek,
        SUM(day) AS voiceMinuteDay
        FROM voiceMinute WHERE guildId = ${guild.id} AND userId = ${userId} AND alltime != 0
        GROUP BY userId) AS voicerank`;
  const textrankSql = `(SELECT userId,
        SUM(alltime) AS textMessageAlltime,
        SUM(year) AS textMessageYear,
        SUM(month) AS textMessageMonth,
        SUM(week) AS textMessageWeek,
        SUM(day) AS textMessageDay
        FROM textMessage WHERE guildId = ${guild.id} AND userId = ${userId} AND alltime != 0
        GROUP BY userId) AS textrank`;
  const voterankSql = `(SELECT userId,
        alltime AS voteAlltime,
        year AS voteYear,
        month AS voteMonth,
        week AS voteWeek,
        day AS voteDay
        FROM vote WHERE guildId = ${guild.id} AND userId = ${userId} AND alltime != 0) AS voterank`;
  const inviterankSql = `(SELECT userId,
        alltime AS inviteAlltime,
        year AS inviteYear,
        month AS inviteMonth,
        week AS inviteWeek,
        day AS inviteDay
        FROM invite WHERE guildId = ${guild.id} AND userId = ${userId} AND alltime != 0) AS inviterank`;
  const bonusrankSql = `(SELECT userId,
        alltime AS bonusAlltime,
        year AS bonusYear,
        month AS bonusMonth,
        week AS bonusWeek,
        day AS bonusDay
        FROM bonus WHERE guildId = ${guild.id} AND userId = ${userId} AND alltime != 0) AS bonusrank`;
  const memberIdSql = `(SELECT '${userId}' AS userId) AS userIds`;

  const memberRankRawSql = `(SELECT
      userIds.userId AS userId,
      IFNULL(voiceMinuteAlltime,0) * ${guild.appData.xpPerVoiceMinute} AS voiceMinuteScoreAlltime,
      IFNULL(voiceMinuteYear,0) * ${guild.appData.xpPerVoiceMinute} AS voiceMinuteScoreYear,
      IFNULL(voiceMinuteMonth,0) * ${guild.appData.xpPerVoiceMinute} AS voiceMinuteScoreMonth,
      IFNULL(voiceMinuteWeek,0) * ${guild.appData.xpPerVoiceMinute} AS voiceMinuteScoreWeek,
      IFNULL(voiceMinuteDay,0) * ${guild.appData.xpPerVoiceMinute} AS voiceMinuteScoreDay,
      IFNULL(textMessageAlltime,0) * ${guild.appData.xpPerTextMessage} AS textMessageScoreAlltime,
      IFNULL(textMessageYear,0) * ${guild.appData.xpPerTextMessage} AS textMessageScoreYear,
      IFNULL(textMessageMonth,0) * ${guild.appData.xpPerTextMessage} AS textMessageScoreMonth,
      IFNULL(textMessageWeek,0) * ${guild.appData.xpPerTextMessage} AS textMessageScoreWeek,
      IFNULL(textMessageDay,0) * ${guild.appData.xpPerTextMessage} AS textMessageScoreDay,
      IFNULL(voteAlltime,0) * ${guild.appData.xpPerVote} AS voteScoreAlltime,
      IFNULL(voteYear,0) * ${guild.appData.xpPerVote} AS voteScoreYear,
      IFNULL(voteMonth,0) * ${guild.appData.xpPerVote} AS voteScoreMonth,
      IFNULL(voteWeek,0) * ${guild.appData.xpPerVote} AS voteScoreWeek,
      IFNULL(voteDay,0) * ${guild.appData.xpPerVote} AS voteScoreDay,
      IFNULL(inviteAlltime,0) * ${guild.appData.xpPerInvite} AS inviteScoreAlltime,
      IFNULL(inviteYear,0) * ${guild.appData.xpPerInvite} AS inviteScoreYear,
      IFNULL(inviteMonth,0) * ${guild.appData.xpPerInvite} AS inviteScoreMonth,
      IFNULL(inviteWeek,0) * ${guild.appData.xpPerInvite} AS inviteScoreWeek,
      IFNULL(inviteDay,0) * ${guild.appData.xpPerInvite} AS inviteScoreDay,
      IFNULL(bonusAlltime,0) * ${guild.appData.xpPerBonus} AS bonusScoreAlltime,
      IFNULL(bonusYear,0) * ${guild.appData.xpPerBonus} AS bonusScoreYear,
      IFNULL(bonusMonth,0) * ${guild.appData.xpPerBonus} AS bonusScoreMonth,
      IFNULL(bonusWeek,0) * ${guild.appData.xpPerBonus} AS bonusScoreWeek,
      IFNULL(bonusDay,0) * ${guild.appData.xpPerBonus} AS bonusScoreDay,
      IFNULL(voiceMinuteAlltime,0) AS voiceMinuteAlltime,
      IFNULL(voiceMinuteYear,0) AS voiceMinuteYear,
      IFNULL(voiceMinuteMonth,0) AS voiceMinuteMonth,
      IFNULL(voiceMinuteWeek,0) AS voiceMinuteWeek,
      IFNULL(voiceMinuteDay,0) AS voiceMinuteDay,
      IFNULL(textMessageAlltime,0) AS textMessageAlltime,
      IFNULL(textMessageYear,0) AS textMessageYear,
      IFNULL(textMessageMonth,0) AS textMessageMonth,
      IFNULL(textMessageWeek,0) AS textMessageWeek,
      IFNULL(textMessageDay,0) AS textMessageDay,
      IFNULL(voteAlltime,0) AS voteAlltime,
      IFNULL(voteYear,0) AS voteYear,
      IFNULL(voteMonth,0) AS voteMonth,
      IFNULL(voteWeek,0) AS voteWeek,
      IFNULL(voteDay,0) AS voteDay,
      IFNULL(inviteAlltime,0) AS inviteAlltime,
      IFNULL(inviteYear,0) AS inviteYear,
      IFNULL(inviteMonth,0) AS inviteMonth,
      IFNULL(inviteWeek,0) AS inviteWeek,
      IFNULL(inviteDay,0) AS inviteDay,
      IFNULL(bonusAlltime,0) AS bonusAlltime,
      IFNULL(bonusYear,0) AS bonusYear,
      IFNULL(bonusMonth,0) AS bonusMonth,
      IFNULL(bonusWeek,0) AS bonusWeek,
      IFNULL(bonusDay,0) AS bonusDay
      FROM ${memberIdSql}
      LEFT JOIN ${voicerankSql} ON userIds.userId = voicerank.userId
      LEFT JOIN ${textrankSql} ON userIds.userId = textrank.userId
      LEFT JOIN ${voterankSql} ON userIds.userId = voterank.userId
      LEFT JOIN ${inviterankSql} ON userIds.userId = inviterank.userId
      LEFT JOIN ${bonusrankSql} ON userIds.userId = bonusrank.userId) AS memberrankraw`;

  const memberRankSql = `(SELECT memberrankraw.*,
      (voiceMinuteScoreAlltime + textMessageScoreAlltime + voteScoreAlltime + inviteScoreAlltime + bonusScoreAlltime) AS totalScoreAlltime,
      (voiceMinuteScoreYear + textMessageScoreYear + voteScoreYear + inviteScoreYear + bonusScoreYear) AS totalScoreYear,
      (voiceMinuteScoreMonth + textMessageScoreMonth + voteScoreMonth + inviteScoreMonth + bonusScoreMonth) AS totalScoreMonth,
      (voiceMinuteScoreWeek + textMessageScoreWeek + voteScoreWeek + inviteScoreWeek + bonusScoreWeek) AS totalScoreWeek,
      (voiceMinuteScoreDay + textMessageScoreDay + voteScoreDay + inviteScoreDay + bonusScoreDay) AS totalScoreDay FROM ${memberRankRawSql})`;

  return memberRankSql;
}

// GENERATED: start of generated content by `exports-to-default`.
// [GENERATED: exports-to-default:v0]

export default {
  getGuildMemberRanks,
  getGuildMemberRank,
  getGuildMemberRankPosition,
  getChannelRanks,
  getChannelMemberRanks,
  getGuildMemberTopChannels,
  countGuildRanks,
  getGuildMemberTotalScore,
};

// GENERATED: end of generated content by `exports-to-default`.
