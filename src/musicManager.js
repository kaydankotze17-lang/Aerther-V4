import { MusicPlayer } from "./player.js";

export class MusicManager {
  constructor(shoukaku) {
    this.shoukaku = shoukaku;
    this.players = new Map();
  }

  get(guildId) {
    if (!this.players.has(guildId)) {
      this.players.set(guildId, new MusicPlayer(this.shoukaku, guildId));
    }
    return this.players.get(guildId);
  }

  remove(guildId) {
    this.players.delete(guildId);
  }

  states() {
    return [...this.players.values()].map((p) => p.state());
  }
}
