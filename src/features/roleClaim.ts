import {
  Client,
  MessageReaction,
  PartialMessageReaction,
  PartialUser,
  User
} from 'discord.js';

import {
  DISCORD_FORGE_CHANNEL_ID,
  DISCORD_GUARD_CLIENT_ID,
  DISCORD_START_HERE_CHANNEL_ID
} from '@/utils/constants';
import { discordLogger } from '@/utils/logger';

const handleReaction = (
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
  add: boolean,
  emojis: { [key: string]: string }
) => {
  if (user.id === DISCORD_GUARD_CLIENT_ID) {
    return;
  }

  const emoji = reaction.emoji.name;
  if (!emoji) return;

  const { guild } = reaction.message;
  if (!guild) return;

  const roleName = emojis[emoji];
  if (!roleName) return;

  const role = guild.roles.cache.find(_role => _role.name === roleName);
  if (!role) return;

  const member = guild.members.cache.find(_member => _member.id === user.id);
  if (!member) return;

  if (add) {
    member.roles.add(role);
  } else {
    member.roles.remove(role);
  }
};

export const roleClaim = (client: Client) => {
  try {
    const startHereChannelId = DISCORD_START_HERE_CHANNEL_ID;
    const forgeChannelId = DISCORD_FORGE_CHANNEL_ID;

    const emojis = {
      cleric: 'Cleric (Account Manager)',
      scribe: 'Scribe (Content Creator)',
      monk: 'Monk (PM)',
      healer: 'Healer (Internal Ops)',
      ranger: 'Ranger (UX Design)',
      tavern: 'Tavern Keeper (Community)',
      alchemist: 'Alchemist (DAO Consultant)',
      hunter: 'Hunter (BizDev)',
      rogue: 'Rogue (Business Affairs/Legal)',
      warrior: 'Warrior (FrontEnd Dev)',
      paladin: 'Paladin (Backend Dev)',
      archer: 'Archer (Visual Design)',
      necro: 'Necromancer (DevOps)',
      dwarf: 'AngryDwarf (Treasury)',
      druid: 'Druid (Data Science/Analyst)',
      wizard: 'Wizard (Smart Contracts)',
      hammer_pick: 'Forge (updates)'
    };

    // const channel = client.channels.cache.get(startHereChannelID);
    // const embed = new MessageEmbed()
    //   .setColor('#ff3864')
    //   .setTitle('Role Selection')
    //   .setDescription(
    //     `Raise your swords and take up a role champ!\n\n__*Pick the roles which you are good at. Choose as many roles as you like - React with the related emoji.\n\nMade a mistake? You can remove roles at any time, the same way you selected them. Just tap the emoji again and the role will be removed*__.\n\n${swordEmoji} ${swordEmoji} ${swordEmoji} ${swordEmoji} ${swordEmoji}\n\n${emojiText}`,
    //   );

    // channel.messages.fetch().then(messages => {
    //   if (messages.size === 0) {
    //     channel.send({ embeds: [embed] }).then(message => {
    //       addReaction(message, reactions);
    //     });
    //   }
    // });

    client.on('messageReactionAdd', (reaction, user) => {
      if (
        reaction.message.channel.id === startHereChannelId ||
        reaction.message.channel.id === forgeChannelId
      ) {
        if (!reaction.emoji.name) return;
        if (!(reaction.emoji.name in emojis)) {
          reaction.users.remove(user.id);
        } else {
          handleReaction(reaction, user, true, emojis);
        }
      }
    });

    client.on('messageReactionRemove', (reaction, user) => {
      if (
        reaction.message.channel.id === startHereChannelId ||
        reaction.message.channel.id === forgeChannelId
      ) {
        handleReaction(reaction, user, false, emojis);
      }
    });
  } catch (err) {
    console.log(err);
    discordLogger('Error caught in role reactions.', client);
  }
};
