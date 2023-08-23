import {
  CacheType,
  CommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder
} from 'discord.js';

import { discordLogger } from '@/utils/logger';

export const roleStatsCommand = new SlashCommandBuilder()
  .setName('primary-roles-count')
  .setDescription('Returns the total number of users in each primary role.');

export const roleStatsExecute = async (
  interaction: CommandInteraction<CacheType>
) => {
  try {
    if (!interaction.guild) {
      console.error('No guild found.');
      return;
    }

    const roles: string[] = [];
    const filterRoles = [
      '@everyone',
      'Available',
      'xDai-Faucet',
      'suggestion_bot',
      'sesh',
      'Friend Time',
      'Collab.Land',
      'Keeper',
      'HausBOT',
      'Server Booster',
      'INACTIVE',
      'verified',
      'Available',
      'BrightID Bot',
      'RaidGuild SourceCred',
      'xDai-Faucet',
      'Friend Time',
      'sesh'
    ];

    let ignoredRoles = '';
    filterRoles.forEach(role => {
      if (role !== '@everyone') ignoredRoles += `__*${role}*__\t\t`;
    });

    interaction.guild.roles.cache.forEach(role => {
      if (!filterRoles.includes(role.name)) {
        const count = interaction.guild?.roles.cache.get(role.id)?.members.size;

        if (count === undefined) {
          console.error(`Role ${role.name} not found.`);
          return;
        }
        roles.push(`${role.name} - ${count}\n`);
      }
    });

    const embed = new EmbedBuilder()
      .setColor('#ff3864')
      .setDescription(
        `Counted in the primary roles while ignoring these.\n\n${ignoredRoles}`
      )
      .addFields({ name: 'Primary roles', value: roles.toString() });

    await interaction.followUp({ embeds: [embed] });
  } catch (err) {
    console.error(err);
    discordLogger('Error caught in role stats command.', interaction.client);
  }
};
