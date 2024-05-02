import { REST, Routes } from 'discord.js';

import {
  queryCommand,
  // syncInvoiceDataCommand,
  tipJesterCommand,
  propsCommand
  // tipXpMcCommand
} from '@/commands';
import {
  DISCORD_DM_CLIENT_ID,
  DISCORD_DM_TOKEN,
  DISCORD_GUILD_ID
} from '@/utils/constants';

const commands = [
  propsCommand.toJSON(),
  queryCommand.toJSON(),
  // syncInvoiceDataCommand.toJSON(),
  tipJesterCommand.toJSON()
  // tipXpAttendanceCommand.toJSON()
];

const rest = new REST().setToken(DISCORD_DM_TOKEN);

(async () => {
  try {
    console.log(
      `Started refreshing ${commands.length} application (/) commands.`
    );

    const data = (await rest.put(
      Routes.applicationGuildCommands(DISCORD_DM_CLIENT_ID, DISCORD_GUILD_ID),
      { body: commands }
    )) as unknown[];

    console.log(
      `Successfully reloaded ${data.length} application (/) commands.`
    );
  } catch (error) {
    console.error(error);
  }
})();
