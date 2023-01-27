import { PublicObject } from '@rebel/server/controllers/ControllerBase'

export type PublicRank = PublicObject<1, {
  schema: 1

  /** The internal id of the rank. */
  id: number

  /** The internal, unique name of the rank. */
  name:
    'admin' |
    'owner' |
    'famous' |
    'mod' |

    // User is permanently banned on the external platforms. No chat will come through.
    'ban' |

    // User is timed out on the external platforms for a period of time. No chat will come through.
    'timeout' |

    // User is not punished on external platforms, and chat will still come through. For internal use only.
    'mute' |

    'donator' |
    'supporter' |
    'member'

  /** The rank group to which this rank belongs to. */
  group:
    // Includes the `owner` and `mod` ranks.
    'administration' |

    // Includes the `famous` rank.
    'cosmetic' |

    // Includes the `ban`, `timeout`, and `mute` ranks.
    'punishment' |

    // Currently unused.
    'donation'

  /** The human-readable name of the rank that fits into the sentence "The name of the user rank is {displayNameNoun}". */
  displayNameNoun: string

  /** The human-readable name of the rank that fits into the sentence "The user is {displayNameAdjective}". */
  displayNameAdjective: string

  /** An optional short description of the rank. */
  description: string | null
}>
