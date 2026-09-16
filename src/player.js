export class MusicPlayer {
  constructor(shoukaku, guildId) {
    this.shoukaku = shoukaku;
    this.guildId = guildId;
    this.player = null;
    this.queue = [];
    this.current = null;
    this.loop = "off";
    this.volume = 80;
  }

  async connect(channelId, selfDeaf = true) {
    this.player = await this.shoukaku.joinVoiceChannel({
      guildId: this.guildId,
      channelId,
      deaf: selfDeaf,
      mute: false
    });

    this.player.on("start", () => this.onStart?.(this.current));
    this.player.on("end", async (data) => {
      if (data?.reason?.reason === "REPLACED") return;
      if (this.loop === "track" && this.current) {
        this.queue.unshift(this.current);
      } else if (this.loop === "queue" && this.current) {
        this.queue.push(this.current);
      }
      this.current = null;
      await this.playNext();
      this.onUpdate?.();
    });

    this.player.on("exception", (data) => {
      console.error(`[player:${this.guildId}] exception`, data);
      this.onError?.(data);
    });

    await this.player.setGlobalVolume(this.volume);
    return this.player;
  }

  enqueue(track) {
    this.queue.push(track);
    return this.queue.length;
  }

  async playNext() {
    if (!this.player) return;
    if (!this.queue.length) {
      this.current = null;
      this.onUpdate?.();
      return;
    }

    this.current = this.queue.shift();
    const encoded = this.current.encoded;
    await this.player.playTrack({
      track: { encoded },
      options: { noReplace: false, paused: false }
    });
    this.onUpdate?.();
  }

  async pause() {
    if (this.player) await this.player.setPaused(true);
  }

  async resume() {
    if (this.player) await this.player.setPaused(false);
  }

  async skip() {
    if (this.player) await this.player.stopTrack();
  }

  async stop() {
    this.queue = [];
    this.current = null;
    if (this.player) await this.player.stopTrack().catch(() => {});
  }

  async setVolume(value) {
    this.volume = Math.max(0, Math.min(150, Number(value)));
    if (this.player) await this.player.setGlobalVolume(this.volume);
  }

  async disconnect() {
    this.queue = [];
    this.current = null;
    if (this.player) await this.player.destroy();
    this.player = null;
  }

  state() {
    const position = this.player?.position ?? 0;
    return {
      guildId: this.guildId,
      connected: Boolean(this.player),
      current: this.current
        ? {
            title: this.current.info?.title || "Unknown",
            author: this.current.info?.author || "Unknown",
            uri: this.current.info?.uri || null,
            artworkUrl: this.current.info?.artworkUrl || null,
            length: this.current.info?.length || 0,
            position
          }
        : null,
      queue: this.queue.map((x) => ({
        title: x.info?.title || "Unknown",
        author: x.info?.author || "Unknown",
        artworkUrl: x.info?.artworkUrl || null
      })),
      loop: this.loop,
      volume: this.volume
    };
  }
}
