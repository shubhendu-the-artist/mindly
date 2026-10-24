"use strict";

/* ==========================================================
   Student Mental Health Score Predictor - script.js
   Sends the form data to the FastAPI backend and shows the
   real prediction it returns. No dummy values are used.
   ========================================================== */

// ---------- Settings ----------
// Deployed FastAPI backend on Render. For local testing, switch to:
// "http://127.0.0.1:8000/predict"
const API_URL = "https://mindly-3s4u.onrender.com/predict";

// Render's free tier sleeps when idle, so the first request can take
// up to a minute while the server wakes up.
const REQUEST_TIMEOUT_MS = 60000;

// The ring is only a visual guide. It is filled as (score / SCORE_SCALE_MAX).
// This is NOT a score range from the backend: set it to match your model's
// target values if you want the ring to fill proportionally.
const SCORE_SCALE_MAX = 10;

// ---------- Field lists (names match the Pydantic model) ----------
const SELECT_FIELDS = [
  "gender", "country", "academic_level",
  "most_used_platform", "purpose_of_use", "stress_level"
];
const ALL_FIELDS = [
  "age", "gender", "country", "academic_level", "most_used_platform",
  "purpose_of_use", "avg_daily_usage_hours", "daily_unlocks",
  "study_hours", "physical_activity_hours", "sleep_hours_per_night",
  "stress_level"
];

// ---------- Page elements ----------
const form = document.getElementById("predict-form");
const submitBtn = document.getElementById("submit-btn");
const submitLabel = submitBtn.querySelector(".btn-label");
const resetBtn = document.getElementById("reset-btn");
const alertBox = document.getElementById("form-alert");
const progressBar = document.getElementById("progress-bar");
const progressText = document.getElementById("progress-text");
const progressTrack = document.getElementById("progress-track");
const emptyState = document.getElementById("empty-state");
const resultCard = document.getElementById("result-card");
const scoreValue = document.getElementById("score-value");
const ringFill = document.getElementById("ring-fill");

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Circle length, used to draw the ring with stroke-dasharray
const RING_LENGTH = 2 * Math.PI * Number(ringFill.getAttribute("r"));
ringFill.style.strokeDasharray = RING_LENGTH;
ringFill.style.strokeDashoffset = RING_LENGTH;

// Sliders count as "answered" in the progress bar once the user moves them
const touchedSliders = new Set();


/* ==========================================================
   Sliders and progress
   ========================================================== */

// Update the coloured track and the live value next to a slider
function refreshSlider(slider) {
  const percent = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
  slider.style.setProperty("--fill", percent + "%");
  document.getElementById(slider.id + "-out").textContent = Number(slider.value) + " h";
}

function isAnswered(name) {
  const field = form.elements[name];
  if (field.type === "range") return touchedSliders.has(name);
  return field.value.trim() !== "";
}

function updateProgress() {
  const answered = ALL_FIELDS.filter(isAnswered).length;
  progressBar.style.width = (answered / ALL_FIELDS.length) * 100 + "%";
  progressText.textContent = answered + " of " + ALL_FIELDS.length;
  progressTrack.setAttribute("aria-valuenow", answered);
}

// One listener handles every input in the form
form.addEventListener("input", (event) => {
  const field = event.target;
  if (field.matches("[data-slider]")) {
    touchedSliders.add(field.name);
    refreshSlider(field);
  }
  clearFieldError(field.name);
  updateProgress();
});

document.querySelectorAll("[data-slider]").forEach(refreshSlider);
updateProgress();


/* ==========================================================
   Validation
   ========================================================== */

function showFieldError(name, message) {
  form.querySelector('[data-error-for="' + name + '"]').textContent = message;
  form.elements[name].setAttribute("aria-invalid", "true");
}

function clearFieldError(name) {
  const box = form.querySelector('[data-error-for="' + name + '"]');
  if (box) box.textContent = "";
  if (form.elements[name]) form.elements[name].removeAttribute("aria-invalid");
}

function clearAllErrors() {
  ALL_FIELDS.forEach(clearFieldError);
  hideAlert();
}

// Returns an object like { age: "message", ... }. Empty object means valid.
function validate() {
  const errors = {};

  const age = form.elements.age.value;
  if (age === "") {
    errors.age = "Enter your age.";
  } else if (!Number.isInteger(Number(age)) || Number(age) < 10 || Number(age) > 100) {
    errors.age = "Age must be a whole number from 10 to 100.";
  }

  SELECT_FIELDS.forEach((name) => {
    if (!form.elements[name].value) errors[name] = "Choose an option.";
  });

  const unlocks = form.elements.daily_unlocks.value;
  if (unlocks === "") {
    errors.daily_unlocks = "Enter how many times you unlock your phone each day.";
  } else if (!Number.isInteger(Number(unlocks)) || Number(unlocks) < 0) {
    errors.daily_unlocks = "Use a whole number of 0 or more.";
  }

  // A day only has 24 hours
  const planned =
    Number(form.elements.study_hours.value) +
    Number(form.elements.physical_activity_hours.value) +
    Number(form.elements.sleep_hours_per_night.value);
  if (planned > 24) {
    errors.sleep_hours_per_night =
      "Study, activity and sleep add up to " + planned + " hours. They must fit within 24.";
  }

  return errors;
}


/* ==========================================================
   Alert box
   ========================================================== */

function showAlert(title, details) {
  alertBox.innerHTML = "";
  const strong = document.createElement("strong");
  strong.textContent = title;
  alertBox.appendChild(strong);

  if (details && details.length) {
    const list = document.createElement("ul");
    details.forEach((text) => {
      const item = document.createElement("li");
      item.textContent = text;
      list.appendChild(item);
    });
    alertBox.appendChild(list);
  }
  alertBox.hidden = false;
}

function hideAlert() {
  alertBox.hidden = true;
  alertBox.innerHTML = "";
}


/* ==========================================================
   Sending the request
   ========================================================== */

// Build the JSON body exactly as the Pydantic model expects it
function buildPayload() {
  const v = (name) => form.elements[name].value;
  return {
    age: parseInt(v("age"), 10),
    gender: v("gender"),
    country: v("country"),
    academic_level: v("academic_level"),
    most_used_platform: v("most_used_platform"),
    purpose_of_use: v("purpose_of_use"),
    avg_daily_usage_hours: parseFloat(v("avg_daily_usage_hours")),
    daily_unlocks: parseInt(v("daily_unlocks"), 10),
    study_hours: parseFloat(v("study_hours")),
    physical_activity_hours: parseFloat(v("physical_activity_hours")),
    sleep_hours_per_night: parseFloat(v("sleep_hours_per_night")),
    stress_level: v("stress_level")
  };
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.classList.toggle("loading", isLoading);
  submitBtn.setAttribute("aria-busy", String(isLoading));
  submitLabel.textContent = isLoading ? "Predicting…" : "Predict My Score";
}

// Turn a FastAPI 422 response into readable lines
function describeApiError(body) {
  if (body && Array.isArray(body.detail)) {
    return body.detail.map((item) => {
      const field = Array.isArray(item.loc) ? item.loc.slice(1).join(".") : "input";
      return field + ": " + item.msg;
    });
  }
  if (body && typeof body.detail === "string") return [body.detail];
  return [];
}

async function requestPrediction(payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    // The body may not be JSON if the server crashed, so parse carefully
    let body = null;
    try { body = await response.json(); } catch (e) { /* ignore */ }

    if (!response.ok) {
      const error = new Error("api");
      error.status = response.status;
      error.details = describeApiError(body);
      throw error;
    }

    const score = body && body.predicted_mental_health_score;
    if (typeof score !== "number" || !Number.isFinite(score)) {
      const error = new Error("api");
      error.details = ["The API response did not include a predicted_mental_health_score number."];
      throw error;
    }
    return score;
  } finally {
    clearTimeout(timer);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearAllErrors();

  // 1. Check the inputs in the browser first
  const errors = validate();
  const names = Object.keys(errors);
  if (names.length > 0) {
    names.forEach((name) => showFieldError(name, errors[name]));
    showAlert("Please fix " + names.length + (names.length === 1 ? " answer" : " answers") + " and try again.");
    form.elements[names[0]].focus();
    return;
  }

  // 2. Ask the API
  setLoading(true);
  // If the server is asleep, tell the user why it's taking a while
  const slowTimer = setTimeout(() => {
    submitLabel.textContent = "Waking up the server…";
  }, 5000);
  try {
    const score = await requestPrediction(buildPayload());
    showResult(score);
  } catch (error) {
    if (error.name === "AbortError") {
      showAlert("The request timed out.", ["The API took longer than " + REQUEST_TIMEOUT_MS / 1000 + " seconds to answer. Try again."]);
    } else if (error instanceof TypeError) {
      // fetch() throws a TypeError when the server can't be reached
      showAlert("Can't reach the prediction API.", [
        "Check that the FastAPI server is running at " + API_URL.replace("/predict", "") + ".",
        "Then try again."
      ]);
    } else if (error.status === 422) {
      showAlert("The API rejected some answers.", error.details);
    } else {
      const prefix = error.status ? "The API returned an error (status " + error.status + ")." : "Something went wrong.";
      showAlert(prefix, error.details);
    }
  } finally {
    clearTimeout(slowTimer);
    setLoading(false);
  }
});


/* ==========================================================
   Showing the result
   ========================================================== */

function showResult(score) {
  emptyState.hidden = true;
  resultCard.hidden = false;

  // Restart the pop-in animation
  resultCard.classList.remove("show");
  void resultCard.offsetWidth;
  resultCard.classList.add("show");

  // Ring: start empty, then fill to score / SCORE_SCALE_MAX
  ringFill.style.transition = "none";
  ringFill.style.strokeDashoffset = RING_LENGTH;
  void ringFill.getBoundingClientRect();
  ringFill.style.transition = "";
  const fraction = Math.min(Math.max(score / SCORE_SCALE_MAX, 0), 1);
  ringFill.style.strokeDashoffset = RING_LENGTH * (1 - fraction);

  countUp(score);
  resultCard.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "nearest" });
}

// Count from 0 to the final score
function countUp(target) {
  if (prefersReducedMotion) {
    scoreValue.textContent = target.toFixed(2);
    return;
  }
  const duration = 1200;
  const start = performance.now();

  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    scoreValue.textContent = (target * eased).toFixed(2);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}


/* ==========================================================
   Reset
   ========================================================== */

resetBtn.addEventListener("click", () => {
  form.reset();                     // restores the starting values
  touchedSliders.clear();
  document.querySelectorAll("[data-slider]").forEach(refreshSlider);
  clearAllErrors();
  updateProgress();

  resultCard.hidden = true;
  emptyState.hidden = false;
  ringFill.style.strokeDashoffset = RING_LENGTH;
  scoreValue.textContent = "0.00";
  form.elements.age.focus();
});