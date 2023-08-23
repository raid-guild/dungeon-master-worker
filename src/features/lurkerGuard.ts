import { Client, Guild } from 'discord.js';

import { DISCORD_ALLOWED_TIME_WITHOUT_ANY_ROLES } from '@/utils/constants';
import { discordLogger } from '@/utils/logger';

export const lurkerGuard = async (client: Client, guild: Guild) => {
  const lurkerGuardCron = async () => {
    const membersFound = await guild.members.fetch();

    try {
      membersFound.forEach(member => {
        const onlyHasEveryoneRole =
          member.roles.cache.size === 1 &&
          member.roles.cache.some(role => role.name === '@everyone');

        if (member.roles.cache.size === 0 || onlyHasEveryoneRole) {
          if (
            Number(member.joinedTimestamp) +
              Number(DISCORD_ALLOWED_TIME_WITHOUT_ANY_ROLES) <
            Date.now()
          ) {
            discordLogger(
              `Lurker with no roles found. Kicked <@${member.id}>.`,
              client
            );
            member.kick();
          }
        }
      });
    } catch (err) {
      discordLogger('Error caught in lurker guard', client);
    }
  };

  setInterval(lurkerGuardCron, Number(DISCORD_ALLOWED_TIME_WITHOUT_ANY_ROLES));
};
