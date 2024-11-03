# Dungeon Master Worker

The DungeonMaster worker managing two different RaidGUild Discord bots: DungeonMaster (limited managing) and RaidGuild Guard (full mananging).

For the DungeonMaster bot, the worker only handles the answering querires about DungeonMaster CRM data.

RaidGuild Guard welcomes everyone who joins the Discord server, and informs them to go to #unlock-channels to view public channels. Those who pass the guild.xyz test are automatically assigned the Moloch Soldier role, which gives permission to view and send messages in the public channels of Raid Guild’s Discord server.

RaidGuild Guard does not allow bots to join the server.

### Public commands

| Command | Description |
| ------- | ----------- |
| NA      | NA          |

### Member-only commands

| Command                 | Description                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| `/tip-props`            | Tips 10 XP in CharacterSheets to anyone @mentioned in the command                          |
| `/record-attendance`    | Tips 20 XP in CharacterSheets to everyone in the voice channel that the command is used in |
| `/query `               | Prompts DM master with a question about specific raid or member data                       |
| `/create-camp-channel ` | Creates a Camp channel with proper permissions                                             |
| `/create-raid-channel`  | Creates a Raid channel with proper permissions                                             |
| `/edit-camp-channel`    | Edits an existing Camp channel to add new non-members                                      |
| `/edit-raid-channel`    | Edits an existing Raid channel to add new non-members                                      |
| `/to-valhalla`          | Archives a channel that is no longer needed                                                |
| `/primary-roles-count`  | Returns the number of users in each primary role                                           |
