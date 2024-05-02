import { SlashCommandBuilder } from 'discord.js';

export const propsCommand = new SlashCommandBuilder()
  .setName('props')
  .setDescription('Gives a fellow member 10 XP (CharacterSheets)')
  .addStringOption(option =>
    option
      .setName('recipients')
      .setDescription(
        'Use @mention to tip XP to an existing character in CharacterSheets'
      )
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('message')
      .setDescription('Give a reason for your tip')
      .setRequired(false)
  );

export const tipXpAttendanceCommand = new SlashCommandBuilder()
  .setName('tip-xp-attendance')
  .setDescription(
    'Gives the characters of everyone in this voice channel 20 XP'
  );

export const tipJesterCommand = new SlashCommandBuilder()
  .setName('tip-jester')
  .setDescription('Gives the meeting MC 50 Jester XP (CharacterSheets)')
  .addStringOption(option =>
    option
      .setName('recipient')
      .setDescription(
        'Use @mention to tip an existing character in CharacterSheets'
      )
      .setRequired(true)
  );

export const syncInvoiceDataCommand = new SlashCommandBuilder()
  .setName('sync-invoice-data')
  .setDescription(
    'Syncs the Smart Escrow invoice data with CharacterSheets XP'
  );
