const socket = io();

const loginScreen = document.getElementById("loginScreen");
const dashboardScreen = document.getElementById("dashboardScreen");

const username = document.getElementById("username");
const status = document.getElementById("status");

const guildSelect = document.getElementById("guildSelect");

const artwork = document.getElementById("artwork");
const noArtwork = document.getElementById("noArtwork");

const trackTitle = document.getElementById("trackTitle");
const trackAuthor = document.getElementById("trackAuthor");

const currentTime = document.getElementById("currentTime");
const duration = document.getElementById("duration");
const progress = document.getElementById("progress");

const playButton = document.getElementById("playButton");
const shuffleButton = document.getElementById("shuffleButton");
const skipBackButton = document.getElementById("skipBackButton");
const skipButton = document.getElementById("skipButton");
const stopButton = document.getElementById("stopButton");

const volumeSlider = document.getElementById("volumeSlider");
const volumeValue = document.getElementById("volumeValue");

const loopOff = document.getElementById("loopOff");
const loopTrack = document.getElementById("loopTrack");
const loopQueue = document.getElementById("loopQueue");

const queue = document.getElementById("queue");
const queueCount = document.getElementById("queueCount");
const refreshQueue = document.getElementById("refreshQueue");

let selectedGuildId = null;
let playerState = null;


/* =========================
   HELPERS
========================= */

function formatTime(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    return "0:00";
  }

  const totalSeconds = Math.floor(milliseconds / 1000);

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/* =========================
   API
========================= */

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.error || `Request failed (${response.status})`
    );
  }

  return data;
}


/* =========================
   LOGIN
========================= */

async function loadUser() {
  try {
    const data = await api("/api/me");

    loginScreen.classList.add("hidden");
    dashboardScreen.classList.remove("hidden");

    const user = data.user;

    username.textContent =
      user.global_name ||
      user.username ||
      "Discord User";

    status.textContent = "● Online";

    guildSelect.innerHTML = `
      <option value="">
        Select a server
      </option>
    `;

    for (const guild of data.guilds || []) {
      const option = document.createElement("option");

      option.value = guild.id;
      option.textContent = guild.name;

      guildSelect.appendChild(option);
    }

  } catch (error) {
    console.log("Not logged in.");

    loginScreen.classList.remove("hidden");
    dashboardScreen.classList.add("hidden");
  }
}


/* =========================
   SERVER SELECTION
========================= */

guildSelect.addEventListener("change", async () => {
  selectedGuildId = guildSelect.value || null;

  if (!selectedGuildId) {
    playerState = null;

    resetPlayer();

    return;
  }

  socket.emit(
    "guild:watch",
    selectedGuildId
  );

  await loadPlayer();
});


/* =========================
   PLAYER
========================= */

async function loadPlayer() {
  if (!selectedGuildId) return;

  try {
    const data = await api(
      `/api/player/${selectedGuildId}`
    );

    updatePlayer(data);

  } catch (error) {
    console.error(
      "Could not load player:",
      error
    );
  }
}


function updatePlayer(state) {
  if (!state) return;

  playerState = state;

  const current = state.current;

  if (!current) {
    trackTitle.textContent = "Nothing playing";
    trackAuthor.textContent =
      "Choose a song from Discord to start playing.";

    artwork.style.display = "none";
    noArtwork.style.display = "flex";

    progress.style.width = "0%";

    currentTime.textContent = "0:00";
    duration.textContent = "0:00";

    playButton.textContent = "▶";

  } else {
    trackTitle.textContent =
      current.title || "Unknown track";

    trackAuthor.textContent =
      current.author || "Unknown artist";

    if (current.artworkUrl) {
      artwork.src = current.artworkUrl;

      artwork.style.display = "block";
      noArtwork.style.display = "none";
    } else {
      artwork.style.display = "none";
      noArtwork.style.display = "flex";
    }

    const position =
      Number(state.position || 0);

    const trackLength =
      Number(
        current.length ||
        current.duration ||
        0
      );

    currentTime.textContent =
      formatTime(position);

    duration.textContent =
      formatTime(trackLength);

    if (trackLength > 0) {
      const percent =
        Math.min(
          100,
          Math.max(
            0,
            (position / trackLength) * 100
          )
        );

      progress.style.width =
        `${percent}%`;
    } else {
      progress.style.width = "0%";
    }

    playButton.textContent =
      state.paused ? "▶" : "⏸";
  }

  const volume =
    Number.isFinite(Number(state.volume))
      ? Number(state.volume)
      : 100;

  volumeSlider.value = volume;
  volumeValue.textContent = `${volume}%`;

  updateLoopButtons(state.loop);

  renderQueue(state.queue || []);
}


/* =========================
   RESET PLAYER
========================= */

function resetPlayer() {
  trackTitle.textContent =
    "Nothing playing";

  trackAuthor.textContent =
    "Choose a server and start playing music.";

  artwork.style.display = "none";
  noArtwork.style.display = "flex";

  progress.style.width = "0%";

  currentTime.textContent = "0:00";
  duration.textContent = "0:00";

  queue.innerHTML = `
    <div class="empty-queue">
      Select a server to view the queue.
    </div>
  `;

  queueCount.textContent = "0 tracks";

  playButton.textContent = "▶";
}


/* =========================
   QUEUE
========================= */

function renderQueue(items) {
  if (!items.length) {
    queue.innerHTML = `
      <div class="empty-queue">
        Queue is empty.
      </div>
    `;

    queueCount.textContent =
      "0 tracks";

    return;
  }

  queueCount.textContent =
    `${items.length} track${items.length === 1 ? "" : "s"}`;

  queue.innerHTML = items
    .map((item, index) => `
      <div class="queue-item">

        <div class="queue-number">
          ${index + 1}
        </div>

        <div class="queue-details">

          <div class="queue-title">
            ${escapeHtml(item.title || "Unknown")}
          </div>

          <div class="queue-author">
            ${escapeHtml(item.author || "Unknown artist")}
          </div>

        </div>

      </div>
    `)
    .join("");
}


/* =========================
   PLAYER ACTION
========================= */

async function playerAction(action, extra = {}) {
  if (!selectedGuildId) {
    alert("Select a server first.");
    return;
  }

  try {
    const data = await api(
      `/api/player/${selectedGuildId}/action`,
      {
        method: "POST",

        body: JSON.stringify({
          action,
          ...extra
        })
      }
    );

    updatePlayer(data);

  } catch (error) {
    console.error(error);

    alert(
      error.message ||
      "Something went wrong."
    );
  }
}


/* =========================
   BUTTONS
========================= */

playButton.addEventListener(
  "click",
  async () => {
    if (!playerState?.current) {
      return;
    }

    if (playerState.paused) {
      await playerAction("resume");
    } else {
      await playerAction("pause");
    }
  }
);


skipButton.addEventListener(
  "click",
  () => {
    playerAction("skip");
  }
);


skipBackButton.addEventListener(
  "click",
  () => {
    if (!playerState?.current) {
      return;
    }

    // Restarting the current track isn't
    // exposed by the backend yet.
    // For now, skip is the safe action.
    playerAction("skip");
  }
);


stopButton.addEventListener(
  "click",
  () => {
    playerAction("stop");
  }
);


shuffleButton.addEventListener(
  "click",
  () => {
    playerAction("shuffle");
  }
);


/* =========================
   VOLUME
========================= */

volumeSlider.addEventListener(
  "input",
  () => {
    volumeValue.textContent =
      `${volumeSlider.value}%`;
  }
);


volumeSlider.addEventListener(
  "change",
  () => {
    playerAction(
      "volume",
      {
        value: Number(volumeSlider.value)
      }
    );
  }
);


/* =========================
   LOOP
========================= */

function updateLoopButtons(mode) {
  loopOff.classList.remove("active");
  loopTrack.classList.remove("active");
  loopQueue.classList.remove("active");

  if (mode === "track") {
    loopTrack.classList.add("active");
  }

  else if (mode === "queue") {
    loopQueue.classList.add("active");
  }

  else {
    loopOff.classList.add("active");
  }
}


loopOff.addEventListener(
  "click",
  () => {
    playerAction(
      "loop",
      {
        value: "off"
      }
    );
  }
);


loopTrack.addEventListener(
  "click",
  () => {
    playerAction(
      "loop",
      {
        value: "track"
      }
    );
  }
);


loopQueue.addEventListener(
  "click",
  () => {
    playerAction(
      "loop",
      {
        value: "queue"
      }
    );
  }
);


/* =========================
   REFRESH
========================= */

refreshQueue.addEventListener(
  "click",
  () => {
    loadPlayer();
  }
);


/* =========================
   LIVE SOCKET UPDATES
========================= */

socket.on(
  "player:update",
  state => {
    if (!selectedGuildId) return;

    updatePlayer(state);
  }
);


/* =========================
   AUTO PROGRESS
========================= */

setInterval(() => {
  if (
    !playerState ||
    !playerState.current ||
    playerState.paused
  ) {
    return;
  }

  const trackLength =
    Number(
      playerState.current.length ||
      playerState.current.duration ||
      0
    );

  if (!trackLength) return;

  playerState.position =
    Number(playerState.position || 0) + 1000;

  if (playerState.position > trackLength) {
    playerState.position = trackLength;
  }

  currentTime.textContent =
    formatTime(playerState.position);

  const percent =
    (playerState.position / trackLength) * 100;

  progress.style.width =
    `${Math.min(100, percent)}%`;

}, 1000);


/* =========================
   START
========================= */

loadUser();
