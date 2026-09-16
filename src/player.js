import { EventEmitter } from "node:events";

export class Player extends EventEmitter {
  constructor(lavalink, guildId) {
    super();

    this.lavalink = lavalink;
    this.guildId = guildId;

    this.player = null;

    this.queue = [];
    this.current = null;

    this.volume = 100;
    this.loop = "off";

    this.position = 0;
    this.paused = false;
  }

  async connect(channelId) {
    const node = this.lavalink.getIdealNode();

    if (!node) {
      throw new Error("No Lavalink node is available.");
    }

    this.player = await node.joinChannel({
      guildId: this.guildId,
      channelId,
      deaf: true
    });

    this.position = 0;
    this.paused = false;

    return this.player;
  }

  enqueue(track) {
    this.queue.push(track);
  }

  async playNext() {
    if (!this.player) {
      throw new Error("Player is not connected.");
    }

    let next = null;

    if (this.loop === "track" && this.current) {
      next = this.current;
    } else {
      next = this.queue.shift();
    }

    if (!next) {
      this.current = null;
      this.position = 0;
      this.paused = false;

      this.emitUpdate();

      return;
    }

    this.current = next;
    this.position = 0;
    this.paused = false;

    await this.player.playTrack({
      track: {
        encoded: next.encoded
      }
    });

    await this.player.setGlobalVolume(this.volume);

    this.emitUpdate();
  }

  async pause() {
    if (!this.player) {
      throw new Error("Player is not connected.");
    }

    await this.player.setPaused(true);

    this.paused = true;

    this.emitUpdate();
  }

  async resume() {
    if (!this.player) {
      throw new Error("Player is not connected.");
    }

    await this.player.setPaused(false);

    this.paused = false;

    this.emitUpdate();
  }

  async skip() {
    if (!this.player) {
      throw new Error("Player is not connected.");
    }

    await this.player.stopTrack();

    if (this.loop === "track") {
      await this.playNext();
      return;
    }

    await this.playNext();
  }

  async stop() {
    if (this.player) {
      await this.player.stopTrack();
    }

    this.queue = [];
    this.current = null;

    this.position = 0;
    this.paused = false;

    this.emitUpdate();
  }

  async setVolume(amount) {
    const value = Math.max(
      0,
      Math.min(100, Number(amount))
    );

    this.volume = value;

    if (this.player) {
      await this.player.setGlobalVolume(value);
    }

    this.emitUpdate();
  }

  async disconnect() {
    if (this.player) {
      await this.player.disconnect();
    }

    this.player = null;

    this.queue = [];
    this.current = null;

    this.position = 0;
    this.paused = false;

    this.emitUpdate();
  }

  state() {
    return {
      guildId: this.guildId,

      connected: Boolean(this.player),

      current: this.current
        ? {
            title:
              this.current.info?.title ||
              "Unknown",

            author:
              this.current.info?.author ||
              "Unknown",

            uri:
              this.current.info?.uri ||
              null,

            artworkUrl:
              this.current.info?.artworkUrl ||
              null,

            length:
              Number(
                this.current.info?.length ||
                0
              )
          }
        : null,

      queue: this.queue.map(track => ({
        title:
          track.info?.title ||
          "Unknown",

        author:
          track.info?.author ||
          "Unknown",

        uri:
          track.info?.uri ||
          null,

        artworkUrl:
          track.info?.artworkUrl ||
          null
      })),

      volume: this.volume,

      loop: this.loop,

      position: this.position,

      paused: this.paused
    };
  }

  emitUpdate() {
    this.emit(
      "update",
      this.state()
    );
  }
}
