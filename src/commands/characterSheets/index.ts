import { CacheType, CommandInteraction, SlashCommandBuilder } from 'discord.js';

export const tipXpCommand = new SlashCommandBuilder()
  .setName('tip-xp')
  .setDescription('Gives a fellow member 5 XP (CharacterSheets')
  .addStringOption(option =>
    option
      .setName('recipients')
      .setDescription(
        'Use @mention to tip an existing character in CharacterSheets'
      )
      .setRequired(true)
  );

export const executeTipXpInteraction = async (
  interaction: CommandInteraction<CacheType>
) => {
  await interaction.followUp({ content: 'Character has been tipped!' });
};
