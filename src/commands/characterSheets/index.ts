import { CacheType, CommandInteraction, SlashCommandBuilder } from 'discord.js';

export const tipXpCommand = new SlashCommandBuilder()
  .setName('tip-xp')
  .setDescription('Gives a fellow member 5 XP (CharacterSheets')
  .addUserOption(option =>
    option
      .setName('member')
      .setDescription(
        'Any member who has an existing character in CharacterSheets'
      )
      .setRequired(true)
  );

export const executeTipXpInteraction = async (
  interaction: CommandInteraction<CacheType>
) => {
  await interaction.followUp({ content: 'Character has been tipped!' });
};
