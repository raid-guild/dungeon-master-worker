# Dungeon Master Worker

The DungeonMaster Worker manages two different RaidGuild Discord bots: DungeonMaster and RaidGuild Guard.

The DungeonMaster bot handles the answering queries about DungeonMaster CRM data. It also interacts with CharacterSheets by allowing props tipping, cleric tipping, jester tipping, and attendance recording.

RaidGuild Guard welcomes everyone who joins the Discord server who is not a bot, and informs them to go to #unlock-channels to view public channels. If newcomers do not verify their account within a certain period of time, they are booted. RaidGuild Guard also handles vairious channel manipulation commands, such as allowing non-members to enter a private channel or sending a stale channel to Valhalla (our channel archives).

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
