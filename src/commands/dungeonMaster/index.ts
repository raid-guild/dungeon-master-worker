import { CacheType, CommandInteraction, SlashCommandBuilder } from 'discord.js';

import { generateResponse } from '@/generate';

export const queryCommand = new SlashCommandBuilder()
  .setName('query')
  .setDescription('Queries the DungeonMaster API for a response')
  .addStringOption(option =>
    option
      .setName('prompt')
      .setDescription('The prompt to generate a response for')
      .setRequired(true)
  );

export const executeQueryInteraction = async (
  interaction: CommandInteraction<CacheType>,
  prompt: string
) => {
  const response = await generateResponse(prompt);
  console.log(`Generated response: ${response}`);

  await interaction.followUp({
    content: `
      Query: ${prompt}\n\nAnswer: **${response}**
    `
  });
};
