/* ============================================
   edit-tenant.js
   Place in: public/js/edit-tenant.js
============================================ */

/* ── Preview new tenant photo before save ── */
const tenantPhotoInput = document.getElementById("tenantPhotoInput");
if (tenantPhotoInput) {
  tenantPhotoInput.addEventListener("change", function () {
    const file = this.files[0];
    if (!file) return;

    if (!["image/jpeg", "image/png"].includes(file.type)) {
      alert("Only JPEG and PNG images are allowed.");
      this.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be under 5MB.");
      this.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = document.getElementById("photoPreview");
      if (preview.tagName === "IMG") {
        preview.src = e.target.result;
      } else {
        // Replace placeholder div with img
        const img = document.createElement("img");
        img.src = e.target.result;
        img.className = "current-photo";
        img.id = "photoPreview";
        img.alt = "New Photo";
        preview.replaceWith(img);
      }
    };
    reader.readAsDataURL(file);
  });
}

/* ── Preview new ID proof image before save ── */
const proofImageInput = document.getElementById("proofImageInput");
if (proofImageInput) {
  proofImageInput.addEventListener("change", function () {
    const file = this.files[0];
    if (!file) return;

    if (!["image/jpeg", "image/png"].includes(file.type)) {
      alert("Only JPEG and PNG images are allowed.");
      this.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be under 5MB.");
      this.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = document.getElementById("proofPreview");
      if (preview.tagName === "IMG") {
        preview.src = e.target.result;
      } else {
        const img = document.createElement("img");
        img.src = e.target.result;
        img.className = "current-photo id-img";
        img.id = "proofPreview";
        img.alt = "New Proof";
        preview.replaceWith(img);
      }
    };
    reader.readAsDataURL(file);
  });
}

/* ── Phone digits only ── */
const phoneInput = document.querySelector('input[name="phone"]');
if (phoneInput) {
  phoneInput.addEventListener("input", function () {
    this.value = this.value.replace(/\D/g, "").slice(0, 10);
  });
}

/* ── Disable save button on submit to prevent double click ── */
const editForm = document.getElementById("editForm");
const saveBtn  = document.getElementById("saveBtn");
if (editForm && saveBtn) {
  editForm.addEventListener("submit", function () {
    saveBtn.disabled     = true;
    saveBtn.textContent  = "Saving...";
  });
}