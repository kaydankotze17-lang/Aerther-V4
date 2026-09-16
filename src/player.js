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
    if (this.player) {
      return this.player;
    }

    this.player =
      await this.lavalink.joinVoiceChannel({
        guildId: this.guildId,
        channelId,
        shardId: 0
      });

    this.position = 0;
    this.paused = false;

    this.player.on("start", () => {
      this.paused = false;
      this.emitUpdate();
    });

    this.player.on("end", async () => {
      try {
        await this.playNext();
      } catch (error) {
        console.error(
          "[music] Track end error:",
          error
        );
      }
    });

    this.player.on("exception", error => {
      console.error(
        "[music] Lavalink exception:",
        error
      );
    });

    this.player.on("stuck", data => {
      console.warn(
        "[music] Track stuck:",
        data
      );
    });

    return this.player;
  }

  enqueue(track) {
    this.queue.push(track);
  }

  async playNext() {
    if (!this.player) {
      throw new Error(
        "Player is not connected."
      );
    }

    let next;

    if (
      this.loop === "track" &&
      this.current
    ) {
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

    console.log(
      `[music] Playing: ${next.info?.title || "Unknown"}`
    );

    await this.player.playTrack(
      next.encoded
    );

    await this.player.setGlobalVolume(
      this.volume
    );

    this.emitUpdate();

    console.log(
      "[music] Track sent to Lavalink."
    );
  }

  async pause() {
    if (!this.player) {
      throw new Error(
        "Player is not connected."
      );
    }

    await this.player.setPaused(true);

    this.paused = true;

    this.emitUpdate();
  }

  async resume() {
    if (!this.player) {
      throw new Error(
        "Player is not connected."
      );
    }

    await this.player.setPaused(false);

    this.paused = false;

    this.emitUpdate();
  }

  async skip() {
    if (!this.player) {
      throw new Error(
        "Player is not connected."
      );
    }

    await this.player.stopTrack();

    if (this.loop === "track") {
      this.loop = "off";
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
      await this.lavalink.leaveVoiceChannel(
        this.guildId
      );
    }

    this.player = null;
    this.queue = [];
    this.current = null;
    this.position = 0;
    this.paused = false;

    this.emitUpdate();
  }

  state() {
    if (this.player) {
      this.position = Number(
        this.player.position || 0
      );

      this.paused = Boolean(
        this.player.paused
      );
    }

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
                this.current.info?.length || 0
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
