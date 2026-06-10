(() => {
  const FEEDBACK_KEY = "prophetia_music_feedback_v1";
  const SUGGESTIONS_KEY = "prophetia_music_suggestions_v1";
  const VOTES_KEY = "prophetia_music_votes_v1";

  const feedbackButton = document.getElementById("musicFeedbackSubmit");
  const avgRatingEl = document.getElementById("musicAvgRating");
  const voteCountEl = document.getElementById("musicVoteCount");
  const tagButtons = Array.from(document.querySelectorAll(".music-tag"));
  const starButtons = Array.from(document.querySelectorAll(".music-star"));

  const form = document.getElementById("musicSuggestionForm");
  const formStatus = document.getElementById("musicFormStatus");
  const suggestionsList = document.getElementById("musicSuggestionsList");

  let selectedTags = new Set();
  let selectedRating = 0;

  function safeRead(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function safeWrite(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getFeedback() {
    return safeRead(FEEDBACK_KEY, []);
  }

  function getSuggestions() {
    return safeRead(SUGGESTIONS_KEY, []);
  }

  function getVotes() {
    return safeRead(VOTES_KEY, {});
  }

  function setStars(rating) {
    selectedRating = rating;
    starButtons.forEach((btn) => {
      const value = Number(btn.dataset.value);
      btn.classList.toggle("is-active", value <= rating);
      btn.setAttribute("aria-checked", value === rating ? "true" : "false");
    });
  }

  function updateFeedbackSummary() {
    const feedback = getFeedback();
    if (!feedback.length) {
      avgRatingEl.textContent = "0.0";
      voteCountEl.textContent = "0 valoraciones";
      return;
    }

    const total = feedback.reduce((sum, item) => sum + Number(item.rating || 0), 0);
    const avg = total / feedback.length;

    avgRatingEl.textContent = avg.toFixed(1);
    voteCountEl.textContent = `${feedback.length} valoraciones`;
  }

  function renderSuggestions() {
    if (!suggestionsList) return;

    const suggestions = [...getSuggestions()].sort((a, b) => (b.votes || 0) - (a.votes || 0));
    const votes = getVotes();

    if (!suggestions.length) {
      suggestionsList.innerHTML = `
        <div class="music-empty">
          Aún no hay propuestas guardadas. La primera canción puede ser la tuya.
        </div>
      `;
      return;
    }

    suggestionsList.innerHTML = suggestions.map((item) => {
      const hasVoted = Boolean(votes[item.id]);
      const spotifyLink = item.url
        ? `<a class="music-vote-btn" href="${item.url}" target="_blank" rel="noopener noreferrer">Abrir Spotify</a>`
        : "";

      return `
        <article class="music-suggestion" data-id="${item.id}">
          <div class="music-suggestion__top">
            <div>
              <h3 class="music-suggestion__song">${escapeHtml(item.title)}</h3>
              <p class="music-suggestion__artist">${escapeHtml(item.artist)}</p>
            </div>
            <span class="music-suggestion__badge">${escapeHtml(item.style)}</span>
          </div>

          <p class="music-suggestion__reason">
            ${escapeHtml(item.reason || "Sin comentario adicional.")}
          </p>

          <div class="music-suggestion__foot">
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <button type="button"
                class="music-vote-btn ${hasVoted ? "is-voted" : ""}"
                data-vote-id="${item.id}">
                ${hasVoted ? "Ya votada" : "Encaja con Prophetia"}
              </button>
              ${spotifyLink}
            </div>

            <span class="music-suggestion__votes">${item.votes || 0} votos</span>
          </div>
        </article>
      `;
    }).join("");

    suggestionsList.querySelectorAll("[data-vote-id]").forEach((btn) => {
      btn.addEventListener("click", () => handleVote(btn.dataset.voteId));
    });
  }

  function handleVote(id) {
    const votes = getVotes();
    if (votes[id]) return;

    const suggestions = getSuggestions().map((item) => {
      if (item.id === id) {
        return { ...item, votes: (item.votes || 0) + 1 };
      }
      return item;
    });

    votes[id] = true;
    safeWrite(SUGGESTIONS_KEY, suggestions);
    safeWrite(VOTES_KEY, votes);
    renderSuggestions();
  }

  function showFormStatus(message) {
    if (!formStatus) return;
    formStatus.hidden = false;
    formStatus.textContent = message;
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function handleFeedbackSubmit() {
    if (!selectedRating) {
      showFormStatus("Selecciona una valoración antes de guardar tu opinión.");
      return;
    }

    const feedback = getFeedback();
    feedback.push({
      rating: selectedRating,
      tags: Array.from(selectedTags),
      createdAt: Date.now()
    });

    safeWrite(FEEDBACK_KEY, feedback);
    updateFeedbackSummary();
    showFormStatus("Tu opinión se ha guardado correctamente.");
  }

  function handleSuggestionSubmit(event) {
    event.preventDefault();

    const title = form.songTitle.value.trim();
    const artist = form.songArtist.value.trim();
    const style = form.songStyle.value.trim();
    const url = form.songUrl.value.trim();
    const reason = form.songReason.value.trim();

    if (!title || !artist || !style) {
      showFormStatus("Completa canción, artista y estilo antes de enviar la propuesta.");
      return;
    }

    const suggestions = getSuggestions();
    suggestions.unshift({
      id: crypto.randomUUID ? crypto.randomUUID() : `song_${Date.now()}`,
      title,
      artist,
      style,
      url,
      reason,
      votes: 0,
      status: "pending",
      createdAt: Date.now()
    });

    safeWrite(SUGGESTIONS_KEY, suggestions);
    form.reset();
    showFormStatus("Tu propuesta ha quedado guardada en la selección de la comunidad.");
    renderSuggestions();
  }

  function bindEvents() {
    tagButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tag = btn.dataset.tag;
        const isActive = btn.classList.toggle("is-active");
        if (isActive) selectedTags.add(tag);
        else selectedTags.delete(tag);
      });
    });

    starButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        setStars(Number(btn.dataset.value));
      });
    });

    if (feedbackButton) {
      feedbackButton.addEventListener("click", handleFeedbackSubmit);
    }

    if (form) {
      form.addEventListener("submit", handleSuggestionSubmit);
    }
  }

  function init() {
    if (!document.body.classList.contains("musica-page")) return;
    bindEvents();
    updateFeedbackSummary();
    renderSuggestions();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();