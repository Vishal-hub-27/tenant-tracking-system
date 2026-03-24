/* ============================================
   add-single.js
   JavaScript for Add Single Tenant form
   Place in: public/js/add-single.js
============================================ */

/* ── State ── */
let cameraStream  = null;
let photosCaptured = {
  livePhoto   : false,
  tenantPhoto : false,
};

/* ══════════════════════════════════════════
   SECTION 1 — Tenant Photo Upload Preview
══════════════════════════════════════════ */

const tenantPhotoInput   = document.getElementById("tenantPhotoInput");
const tenantPhotoPreview = document.getElementById("tenantPhotoPreview");
const uploadBox          = document.getElementById("uploadBox");
const uploadHint         = document.getElementById("uploadHint");

tenantPhotoInput.addEventListener("change", function () {
  const file = this.files[0];
  if (!file) return;

  /* Only allow jpeg / png */
  if (!["image/jpeg", "image/png"].includes(file.type)) {
    showAlert("Only JPEG and PNG images are allowed.");
    this.value = "";
    return;
  }

  /* Max 5MB */
  if (file.size > 5 * 1024 * 1024) {
    showAlert("File size must be under 5MB.");
    this.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    tenantPhotoPreview.src = e.target.result;
    tenantPhotoPreview.classList.add("visible");
    uploadBox.classList.add("has-image");
  };
  reader.readAsDataURL(file);

  photosCaptured.tenantPhoto = true;
  updateSubmitButton();
});

/* ══════════════════════════════════════════
   SECTION 2 — Live Camera Capture
══════════════════════════════════════════ */

const openCameraBtn  = document.getElementById("openCameraBtn");
const captureBtn     = document.getElementById("captureBtn");
const stopBtn        = document.getElementById("stopBtn");
const retakeBtn      = document.getElementById("retakeBtn");
const cameraBox      = document.getElementById("cameraBox");
const cameraPreview  = document.getElementById("cameraPreview");
const capturedImg    = document.getElementById("capturedImg");
const cameraResult   = document.getElementById("cameraResult");
const captureStatus  = document.getElementById("captureStatus");
const livePhotoData  = document.getElementById("livePhotoData");

/* Open camera */
openCameraBtn.addEventListener("click", function () {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showAlert("Camera is not supported on this device or browser.");
    return;
  }

  navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
    .then(function (stream) {
      cameraStream = stream;
      cameraPreview.srcObject = stream;
      cameraBox.classList.add("active");
      openCameraBtn.style.display = "none";
    })
    .catch(function (err) {
      showAlert("Could not access camera. Please allow camera permission in your browser.");
      console.error("Camera error:", err);
    });
});

/* Capture photo from video stream */
captureBtn.addEventListener("click", function () {
  const video  = cameraPreview;
  const canvas = document.createElement("canvas");

  canvas.width  = video.videoWidth  || 640;
  canvas.height = video.videoHeight || 480;
  canvas.getContext("2d").drawImage(video, 0, 0);

  /* Convert to base64 JPEG and store in hidden input */
  const base64 = canvas.toDataURL("image/jpeg", 0.85);
  livePhotoData.value = base64;

  /* Show captured image */
  capturedImg.src = base64;
  cameraResult.classList.add("active");

  photosCaptured.livePhoto = true;
  updateSubmitButton();

  stopCameraStream();
});

/* Stop camera without capturing */
stopBtn.addEventListener("click", function () {
  stopCameraStream();
  openCameraBtn.style.display = "inline-block";
});

/* Retake — reset and open camera again */
retakeBtn.addEventListener("click", function () {
  livePhotoData.value   = "";
  capturedImg.src       = "";
  cameraResult.classList.remove("active");
  photosCaptured.livePhoto = false;
  updateSubmitButton();
  openCameraBtn.style.display = "inline-block";
});

/* Internal: stop the camera stream tracks */
function stopCameraStream() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  cameraBox.classList.remove("active");
}

/* ══════════════════════════════════════════
   SECTION 3 — Form Validation on Submit
══════════════════════════════════════════ */

const tenantForm = document.getElementById("tenantForm");
const submitBtn  = document.getElementById("submitBtn");

tenantForm.addEventListener("submit", function (e) {

  /* Check live photo */
  if (!livePhotoData.value) {
    e.preventDefault();
    showAlert("Please capture a live photo before saving.");
    return;
  }

  /* Check tenant photo */
  if (!tenantPhotoInput.files[0]) {
    e.preventDefault();
    showAlert("Please upload a tenant photo.");
    return;
  }

  /* Disable button to prevent double submit */
  submitBtn.disabled    = true;
  submitBtn.textContent = "Saving...";
});

/* ══════════════════════════════════════════
   SECTION 4 — Phone number: digits only
══════════════════════════════════════════ */

const phoneInput = document.querySelector('input[name="phone"]');
phoneInput.addEventListener("input", function () {
  this.value = this.value.replace(/\D/g, "").slice(0, 10);
});

/* ══════════════════════════════════════════
   SECTION 5 — Helpers
══════════════════════════════════════════ */

/* Enable / disable submit button based on both photos */
function updateSubmitButton() {
  const allDone = photosCaptured.tenantPhoto && photosCaptured.livePhoto;
  submitBtn.disabled = false; /* always allow — server validates too */

  if (allDone) {
    submitBtn.style.opacity = "1";
  }
}

/* Simple alert helper */
function showAlert(message) {
  const existing = document.getElementById("jsAlert");
  if (existing) existing.remove();

  const div = document.createElement("div");
  div.id = "jsAlert";
  div.className = "alert alert-warning alert-dismissible fade show rounded-3 mt-3";
  div.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;

  tenantForm.insertBefore(div, tenantForm.firstChild);
  div.scrollIntoView({ behavior: "smooth", block: "center" });
}

/* Stop camera if user leaves the page */
window.addEventListener("beforeunload", function () {
  stopCameraStream();
});