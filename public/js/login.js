/* ============================================
   login.js — shared by login.ejs & register.ejs
   Place in: public/js/login.js
============================================ */

/* ── Toggle password visibility ── */
function togglePassword() {
  const input   = document.getElementById("passwordInput");
  const icon    = document.getElementById("eyeIcon");
  const isHidden = input.type === "password";

  input.type = isHidden ? "text" : "password";

  // Swap icon between eye and eye-off
  icon.innerHTML = isHidden
    ? `<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
       <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
       <line x1="1" y1="1" x2="23" y2="23"/>`
    : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
       <circle cx="12" cy="12" r="3"/>`;
}

/* ── Confirm password match check (register page only) ── */
const confirmInput = document.getElementById("confirmInput");
if (confirmInput) {
  confirmInput.addEventListener("input", function () {
    const password = document.getElementById("passwordInput").value;
    const matchMsg = document.getElementById("matchMsg");

    if (this.value.length === 0) {
      matchMsg.style.display = "none";
      return;
    }

    if (this.value === password) {
      matchMsg.textContent   = "✓ Passwords match";
      matchMsg.style.color   = "#1D9E75";
      matchMsg.style.display = "block";
    } else {
      matchMsg.textContent   = "✗ Passwords do not match";
      matchMsg.style.color   = "#dc3545";
      matchMsg.style.display = "block";
    }
  });
}

/* ── Phone digits only (register page) ── */
const phoneInput = document.querySelector('input[name="phone"]');
if (phoneInput) {
  phoneInput.addEventListener("input", function () {
    this.value = this.value.replace(/\D/g, "").slice(0, 10);
  });
}

/* ── Disable submit button on form submit ── */
const loginForm    = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const activeForm   = loginForm || registerForm;

if (activeForm) {
  activeForm.addEventListener("submit", function () {
    const btn = this.querySelector("button[type='submit']");
    if (btn) {
      btn.disabled     = true;
      btn.style.opacity = "0.7";
    }
  });
}