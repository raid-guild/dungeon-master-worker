export const SCHEMAS = `
  type Member {
    id: ID!
    name: String!
    eth_address: String
    contact_info: ContactInfo
    is_raiding: Boolean
    guild_class: GuildClass
    created_at: Date!
    updated_at: Date!
  }

  type GuildClass {
    guild_class: GuildClassOptions!
  }

  enum GuildClassOptions {
    COMMUNITY
    DESIGN
    TREASURY
    MARKETING
    FRONTEND_DEV
    OPERATIONS
    BIZ_DEV
    BACKEND_DEV
    PROJECT_MANAGEMENT
    SMART_CONTRACTS
    LEGAL
    ACCOUNT_MANAGER
  }

  type ContactInfo {
    id: ID!
    email: String
    discord: String
    twitter: String
    telegram: String
    github: String
  }

  type Raid {
    id: ID!
    name: String!
    status_key: RaidStatusOptions!
  }

  enum RaidStatusOptions {
    AWAITING
    PREPARING
    RAIDING
    SHIPPED
    LOST
  }
`;
