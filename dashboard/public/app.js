const login = document.querySelector("#login");
const app = document.querySelector("#app");
const guild = document.querySelector("#guild");
const socket = io();

let state = null;
let guildId = null;

async function api(url, options) {
  const r = await fetch(url, options);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Request failed");
  return data;
}

function render(s) {
  state = s;
  const current = s.current;
  document.querySelector("#title").textContent = current?.title || "Nothing playing";
  document.querySelector("#author").textContent = current?.author || "—";
  const art = document.querySelector("#art");
  art.src = current?.artworkUrl || "";
  art.style.visibility = current?.artworkUrl ? "visible" : "hidden";
  document.querySelector("#volume").value = s.volume ?? 80;
  document.querySelector("#loop").value = s.loop ?? "off";

  const queue = document.querySelector("#queue");
  queue.innerHTML = "";
  if (!s.queue?.length) {
    queue.innerHTML = '<div class="track"><span>Queue is empty</span><span>—</span></div>';
  } else {
    s.queue.forEach((x, i) => {
      const row = document.createElement("div");
      row.className = "track";
      row.innerHTML = `<span>${i + 1}. ${escapeHtml(x.title)}</span><span>${escapeHtml(x.author)}</span>`;
      queue.appendChild(row);
    });
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function loadPlayer() {
  if (!guildId) return;
  render(await api(`/api/player/${guildId}`));
  socket.emit("guild:watch", guildId);
}

async function action(action, extra = {}) {
  if (!guildId) return;
  try {
    render(await api(`/api/player/${guildId}/action`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ action, ...extra })
    }));
  } catch (e) {
    alert(e.message);
  }
}

document.querySelectorAll("[data-action]").forEach(b => {
  b.addEventListener("click", () => action(b.dataset.action));
});

document.querySelector("#volume").addEventListener("change", e => action("volume", { value: e.target.value }));
document.querySelector("#loop").addEventListener("change", e => action("loop", { value: e.target.value }));
guild.addEventListener("change", () => {
  guildId = guild.value;
  loadPlayer();
});

socket.on("player:update", s => {
  if (s.guildId === guildId) render(s);
});

(async function init() {
  try {
    const data = await api("/api/me");
    login.hidden = true;
    app.hidden = false;
    document.querySelector("#user").textContent = data.user.username;
    guild.innerHTML = data.guilds.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join("");
    guildId = data.guilds[0]?.id;
    if (guildId) await loadPlayer();
    else document.querySelector("#title").textContent = "No shared servers";
  } catch {
    login.hidden = false;
    app.hidden = true;
  }
})();
