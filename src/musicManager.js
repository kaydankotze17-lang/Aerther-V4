import { Player } from "./player.js";

export class MusicManager {
  constructor(lavalink) {
    this.lavalink = lavalink;
    this.players = new Map();
  }

  get(guildId) {
    if (!this.players.has(guildId)) {
      const player = new Player(
        this.lavalink,
        guildId
      );

      this.players.set(guildId, player);
    }

    return this.players.get(guildId);
  }

  remove(guildId) {
    const player = this.players.get(guildId);

    if (player) {
      player.disconnect().catch(error => {
        console.error(
          `[music] Failed to disconnect ${guildId}:`,
          error
        );
      });
    }

    this.players.delete(guildId);
  }

  has(guildId) {
    return this.players.has(guildId);
  }

  all() {
    return [...this.players.values()];
  }
}
