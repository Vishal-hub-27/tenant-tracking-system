/* ============================================
   family.js — camera for add-head form
   Place in: public/js/family.js
============================================ */

let camStream = null;

/* ── Head Photo Preview ── */
const headPhotoInput = document.getElementById("headPhotoInput");
if (headPhotoInput) {
  headPhotoInput.addEventListener("change", function () {
    const file = this.files[0];
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) { alert("Only JPEG/PNG allowed."); this.value = ""; return; }
    if (file.size > 5 * 1024 * 1024) { alert("Max 5MB."); this.value = ""; return; }
    const reader = new FileReader();
    reader.onload = e => {
      const prev = document.getElementById("headPhotoPreview");
      prev.src = e.target.result;
      prev.classList.add("visible");
      document.getElementById("uploadBox").classList.add("has-image");
    };
    reader.readAsDataURL(file);
  });
}

/* ── Camera open ── */
const openCamBtn = document.getElementById("openCamBtn");
if (openCamBtn) {
  openCamBtn.addEventListener("click", function () {
    if (!navigator.mediaDevices) { alert("Camera not supported."); return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
      .then(stream => {
        camStream = stream;
        document.getElementById("camVideo").srcObject = stream;
        document.getElementById("camStream").style.display = "block";
        document.getElementById("capBtn").style.display    = "inline-block";
        document.getElementById("stopCamBtn").style.display= "inline-block";
        openCamBtn.style.display = "none";
      })
      .catch(() => alert("Could not access camera. Please allow camera permission."));
  });
}

/* ── Capture ── */
const capBtn = document.getElementById("capBtn");
if (capBtn) {
  capBtn.addEventListener("click", function () {
    const video  = document.getElementById("camVideo");
    const canvas = document.createElement("canvas");
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const base64 = canvas.toDataURL("image/jpeg", 0.85);
    document.getElementById("livePhotoData").value = base64;
    document.getElementById("capturedImg").src      = base64;
    document.getElementById("camResult").style.display = "block";
    stopCam();
  });
}

/* ── Stop cam ── */
const stopCamBtn = document.getElementById("stopCamBtn");
if (stopCamBtn) {
  stopCamBtn.addEventListener("click", function () {
    stopCam();
    document.getElementById("openCamBtn").style.display = "inline-block";
  });
}

/* ── Retake ── */
const retakeBtn = document.getElementById("retakeBtn");
if (retakeBtn) {
  retakeBtn.addEventListener("click", function () {
    document.getElementById("livePhotoData").value     = "";
    document.getElementById("camResult").style.display = "none";
    document.getElementById("openCamBtn").style.display= "inline-block";
  });
}

function stopCam() {
  if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; }
  document.getElementById("camStream").style.display   = "none";
  document.getElementById("capBtn").style.display      = "none";
  document.getElementById("stopCamBtn").style.display  = "none";
}

/* ── Validate on submit ── */
const headForm = document.getElementById("headForm");
if (headForm) {
  headForm.addEventListener("submit", function (e) {
    if (!document.getElementById("livePhotoData").value) {
      e.preventDefault();
      alert("Please capture a live photo before saving.");
      return;
    }
    const btn = document.getElementById("submitBtn");
    if (btn) { btn.disabled = true; btn.textContent = "Saving..."; }
  });
}

/* ── Phone digits only ── */
const phoneInput = document.querySelector('input[name="phone"]');
if (phoneInput) {
  phoneInput.addEventListener("input", function () {
    this.value = this.value.replace(/\D/g, "").slice(0, 10);
  });
}

window.addEventListener("beforeunload", () => { if (camStream) stopCam(); });