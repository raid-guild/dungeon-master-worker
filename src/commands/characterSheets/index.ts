import { SlashCommandBuilder } from 'discord.js';

export const tipXpCommand = new SlashCommandBuilder()
  .setName('tip-xp')
  .setDescription('Gives a fellow member 10 XP (CharacterSheets)')
  .addStringOption(option =>
    option
      .setName('recipients')
      .setDescription(
        'Use @mention to tip an existing character in CharacterSheets'
      )
      .setRequired(true)
  );

export const tipXpAttendanceCommand = new SlashCommandBuilder()
  .setName('tip-xp-attendance')
  .setDescription(
    'Gives the characters of everyone in this voice channel 20 XP'
  );

export const tipXpMcCommand = new SlashCommandBuilder()
  .setName('tip-xp-mc')
  .setDescription(
    'Gives the meeting MC 50 XP (CharacterSheets). 5 emoji reactions are required for the tip to succeed'
  )
  .addStringOption(option =>
    option
      .setName('recipient')
      .setDescription(
        'Use @mention to tip an existing character in CharacterSheets'
      )
      .setRequired(true)
  );
