const express= require("express");
const mongoose= require("mongoose");
const path= require("path");
const multer= require("multer");
const bcrypt= require("bcryptjs");
const session= require("express-session");
const MongoStore= require("connect-mongo").default;
const methodOverride = require("method-override");
require("dotenv").config();

const Owner         = require("./models/owner");
const SingleTenant  = require("./models/singletenant");
const SingleIdProof = require("./models/singleidProof");
const StayHistory   = require("./models/stayhistory");
const FamilyHead    = require("./models/familyhead");
const FamilyMember  = require("./models/familymember");
const FamilyIdProof = require("./models/familyproof");
const isAuth        = require("./middleware/isAuth");

const app = express();

// ════════════════════════════════════════
// MIDDLEWARE
// ════════════════════════════════════════
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));  
app.use(express.static(path.join(__dirname, "public")));

// ════════════════════════════════════════
// VIEW ENGINE
// ════════════════════════════════════════
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ════════════════════════════════════════
// MONGODB CONNECTION
// ════════════════════════════════════════
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB error:", err));

// ════════════════════════════════════════
// SESSION SETUP
// Sessions are stored in MongoDB so they
// survive server restarts
// ════════════════════════════════════════
app.use(session({
  secret           : process.env.SESSION_SECRET,
  resave           : false,
  saveUninitialized: false,
  store            : MongoStore.create({
    mongoUrl  : process.env.MONGO_URI,
    ttl       : 7 * 24 * 60 * 60, // 7 days in seconds
    autoRemove: "native",
  }),
  cookie: {
    maxAge  : 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    httpOnly: true,
    secure  : false, // set true in production with HTTPS
  },
}));

// ════════════════════════════════════════
// MAKE OWNER AVAILABLE IN ALL EJS VIEWS
// res.locals.owner is accessible in every
// EJS file without passing it manually
// ════════════════════════════════════════
app.use(async (req, res, next) => {
  if (req.session?.ownerId) {
    try {
      const owner = await Owner.findById(req.session.ownerId).select("-password");
      res.locals.owner = owner;
    } catch {
      res.locals.owner = null;
    }
  } else {
    res.locals.owner = null;
  }
  next();
});

// ════════════════════════════════════════
// MULTER SETUP
// ════════════════════════════════════════
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/jpg", "image/png"];
  allowed.includes(file.mimetype)
    ? cb(null, true)
    : cb(new Error("Only JPEG and PNG allowed"), false);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// ════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════
const base64ToBuffer = (str) => {
  const data = str.replace(/^data:image\/\w+;base64,/, "");
  return Buffer.from(data, "base64");
};

const bufferToBase64 = (buffer, mimetype) => {
  if (!buffer) return null;
  return `data:${mimetype};base64,${buffer.toString("base64")}`;
};

// ════════════════════════════════════════
// PUBLIC ROUTES  (no login needed)
// ════════════════════════════════════════

// Home — redirect based on session
app.get("/", (req, res) => {
  if (req.session?.ownerId) {
    return res.redirect("/dashboard");
  }
  res.redirect("/login");
});

// ── GET Login page ──
app.get("/login", (req, res) => {
  if (req.session?.ownerId) return res.redirect("/dashboard");
  res.render("auth/login", { error: null, formData: {} });
});

// ── POST Login — check email + password ──
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Basic validation
    if (!email || !password) {
      return res.render("auth/login", {
        error   : "Email and password are required.",
        formData: { email },
      });
    }

    // Find owner by email
    const owner = await Owner.findOne({ email: email.toLowerCase().trim() });
    if (!owner) {
      return res.render("auth/login", {
        error   : "Invalid email or password.",
        formData: { email },
      });
    }

    // Compare password with bcrypt hash
    const isMatch = await bcrypt.compare(password, owner.password);
    if (!isMatch) {
      return res.render("auth/login", {
        error   : "Invalid email or password.",
        formData: { email },
      });
    }

    // ✅ Correct — save owner ID in session
    req.session.ownerId = owner._id.toString();

    // Redirect to dashboard
    res.redirect("/dashboard");

  } catch (err) {
    console.error("POST /login error:", err);
    res.render("auth/login", {
      error   : "Something went wrong. Please try again.",
      formData: { email: req.body.email },
    });
  }
});

// ── GET Register page ──
app.get("/register", (req, res) => {
  if (req.session?.ownerId) return res.redirect("/dashboard");
  res.render("auth/register", { errors: [], formData: {} });
});

// ── POST Register — create new owner ──
app.post("/register", async (req, res) => {
  try {
    const { name, phone, email, password, confirm_password, house_address } = req.body;

    // Validate
    const errors = [];
    if (!name?.trim())          errors.push({ msg: "Name is required" });
    if (!phone?.trim())         errors.push({ msg: "Phone is required" });
    if (phone?.length !== 10)   errors.push({ msg: "Phone must be 10 digits" });
    if (!email?.trim())         errors.push({ msg: "Email is required" });
    if (!password)              errors.push({ msg: "Password is required" });
    if (password?.length < 6)   errors.push({ msg: "Password must be at least 6 characters" });
    if (password !== confirm_password) errors.push({ msg: "Passwords do not match" });
    if (!house_address?.trim()) errors.push({ msg: "House address is required" });

    if (errors.length > 0) {
      return res.render("auth/register", {
        errors,
        formData: { name, phone, email, house_address },
      });
    }

    // Check if email already exists
    const existing = await Owner.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.render("auth/register", {
        errors  : [{ msg: "This email is already registered. Please login." }],
        formData: { name, phone, email, house_address },
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save owner
    const owner = await Owner.create({
      name         : name.trim(),
      phone        : phone.trim(),
      email        : email.toLowerCase().trim(),
      password     : hashedPassword,
      house_address: house_address.trim(),
    });

    // Auto login after registration
    req.session.ownerId = owner._id.toString();
    res.redirect("/dashboard");

  } catch (err) {
    console.error("POST /register error:", err);
    res.render("auth/register", {
      errors  : [{ msg: "Something went wrong. Please try again." }],
      formData: req.body,
    });
  }
});

// ── GET Logout ──
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error("Logout error:", err);
    res.redirect("/login");
  });
});

// ════════════════════════════════════════
// PROTECTED ROUTES  (login required)
// isAuth middleware checks session
// ════════════════════════════════════════

// ── Dashboard ──
app.get("/dashboard", isAuth, async (req, res) => {
  try {
    const ownerId = req.session.ownerId;

    // Count active tenants for this owner
    const singleCount = await SingleTenant.countDocuments({
      owner_id: ownerId,
      status  : "active",
    });

    res.render("owner", {
      title      : "Dashboard",
      singleCount,
    });

  } catch (err) {
    console.error("GET /dashboard error:", err);
    res.status(500).render("error", { message: "Something went wrong." });
  }
});

// ════════════════════════════════════════
// ROUTES — ADD SINGLE TENANT
// All protected with isAuth
// ownerId comes from session — not URL
// ════════════════════════════════════════

// GET — open Add Single Tenant form
app.get("/single/add", isAuth, (req, res) => {
  res.render("tenants/add-single", {
    title   : "Add Single Tenant",
    errors  : [],
    formData: {},
  });
});

// POST — save tenant to MongoDB
app.post(
  "/single/add",
  isAuth,
  upload.fields([{ name: "tenant_photo", maxCount: 1 }]),
  async (req, res) => {
    try {
      // Get ownerId from session — not from URL
      console.log("go in save");
      const ownerId = req.session.ownerId;

      const { name, phone, occupation, permanent_address, live_photo_base64 } = req.body;
      const tenantPhotoFile = req.files?.tenant_photo?.[0];

      // Validate
      const errors = [];
      if (!name?.trim())                errors.push({ msg: "Name is required" });
      if (!phone?.trim())               errors.push({ msg: "Phone is required" });
      if (phone && phone.length !== 10) errors.push({ msg: "Phone must be 10 digits" });
      if (!occupation?.trim())          errors.push({ msg: "Occupation is required" });
      if (!permanent_address?.trim())   errors.push({ msg: "Permanent address is required" });
      if (!tenantPhotoFile)             errors.push({ msg: "Tenant photo is required" });
      if (!live_photo_base64)           errors.push({ msg: "Live photo capture is required" });

      if (errors.length > 0) {
        return res.render("tenants/add-single", {
          title   : "Add Single Tenant",
          errors,
          formData: { name, phone, occupation, permanent_address },
        });
      }

      // Save tenant — owner_id from session
      const tenant = await SingleTenant.create({
        owner_id         : ownerId,
        name             : name.trim(),
        phone            : phone.trim(),
        occupation       : occupation.trim(),
        permanent_address: permanent_address.trim(),
        tenant_photo: {
          data    : tenantPhotoFile.buffer,
          mimetype: tenantPhotoFile.mimetype,
          filename: tenantPhotoFile.originalname,
        },
        live_photo: {
          data       : base64ToBuffer(live_photo_base64),
          mimetype   : "image/jpeg",
          captured_at: new Date(),
        },
      });

      // Save stay history
      await StayHistory.create({
        owner_id         : ownerId,
        tenant_ref_id    : tenant._id,
        tenant_type_model: "SingleTenant",
        tenant_type      : "single",
        move_in_date     : new Date(),
      });

      res.redirect(`/single/${tenant._id}/id-proof`);

    } catch (err) {
      console.error("POST /single/add error:", err);
      res.status(500).render("error", { message: "Something went wrong." });
    }
  }
);

// ════════════════════════════════════════
// ROUTES — ID PROOF
// ════════════════════════════════════════

// GET — open ID proof form
app.get("/single/:tenantId/id-proof", isAuth, async (req, res) => {
  try {
    const tenant = await SingleTenant.findById(req.params.tenantId);
    if (!tenant) return res.status(404).render("error", { message: "Tenant not found." });

    res.render("tenants/id-proof", {
      title     : "Add ID Proof",
      tenantId  : req.params.tenantId,
      tenantName: tenant.name,
      errors    : [],
      formData  : {},
    });
  } catch (err) {
    res.status(500).render("error", { message: "Something went wrong." });
  }
});

// POST — save ID proof
app.post(
  "/single/:tenantId/id-proof",
  isAuth,
  upload.fields([{ name: "proof_image", maxCount: 1 }]),
  async (req, res) => {
    try {
      const { tenantId } = req.params;
      const { id_proof_type, id_proof_number } = req.body;
      const proofImageFile = req.files?.proof_image?.[0];

      const errors = [];
      if (!id_proof_type)           errors.push({ msg: "Please select ID proof type" });
      if (!id_proof_number?.trim()) errors.push({ msg: "ID proof number is required" });
      if (!proofImageFile)          errors.push({ msg: "Please upload proof image" });

      if (errors.length > 0) {
        const tenant = await SingleTenant.findById(tenantId);
        return res.render("tenants/id-proof", {
          title     : "Add ID Proof",
          tenantId,
          tenantName: tenant?.name || "",
          errors,
          formData  : { id_proof_type, id_proof_number },
        });
      }

      await SingleIdProof.create({
        tenant_id      : tenantId,
        id_proof_type,
        id_proof_number: id_proof_number.trim(),
        proof_image: {
          data    : proofImageFile.buffer,
          mimetype: proofImageFile.mimetype,
          filename: proofImageFile.originalname,
        },
        uploaded_at: new Date(),
      });

      res.redirect(`/dashboard`);

    } catch (err) {
      console.error("POST /id-proof error:", err);
      res.status(500).render("error", { message: "Something went wrong." });
    }
  }
);

// ─────────────────────────────────────────
// GET /single
// Tenant List Page — fetches all tenants
// for logged-in owner from MongoDB
// ─────────────────────────────────────────
app.get("/single", isAuth, async (req, res) => {
  try {
    const ownerId = req.session.ownerId;

    // .lean() is REQUIRED — converts Mongoose docs to plain JS
    // objects so Buffer.toString('base64') works in EJS
    const tenants = await SingleTenant.find({ owner_id: ownerId })
      .sort({ createdAt: -1 })
      .lean();

    res.render("tenants/tenantlist", {
      title  : "Tenant List",
      tenants,
    });

  } catch (err) {
    console.error("GET /single error:", err);
    res.status(500).render("error", { message: "Could not load tenants." });
  }
});


// ─────────────────────────────────────────
// GET /single/:tenantId/detail
// Overall Info Page — shows all details,
// photos, ID proof for one tenant
// ─────────────────────────────────────────
app.get("/single/:tenantId/detail", isAuth, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const ownerId      = req.session.ownerId;

    // Fetch tenant — .lean() for Buffer support in EJS
    const tenant = await SingleTenant.findOne({
      _id     : tenantId,
      owner_id: ownerId,   // security: only show if belongs to this owner
    }).lean();

    if (!tenant) {
      return res.status(404).render("error", {
        message: "Tenant not found.",
      });
    }

    // Fetch ID proof linked to this tenant
    const idProof = await SingleIdProof.findOne({
      tenant_id: tenantId,
    }).lean();

    // Fetch owner info to show on the page
    const ownerInfo = await Owner.findById(ownerId)
      .select("name phone house_address")
      .lean();

    res.render("tenants/tenantdetail", {
      title    : `${tenant.name} — Details`,
      tenant,
      idProof,    // null if not uploaded yet — EJS handles this
      ownerInfo,
    });

  } catch (err) {
    console.error("GET /detail error:", err);
    res.status(500).render("error", { message: "Could not load tenant details." });
  }
});


// ─────────────────────────────────────────
// POST /single/:tenantId/delete
// Soft delete — sets status to inactive
// ─────────────────────────────────────────
app.post("/single/:tenantId/delete", isAuth, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const ownerId      = req.session.ownerId;

    // Security: only delete if tenant belongs to this owner
    const tenant = await SingleTenant.findOne({
      _id     : tenantId,
      owner_id: ownerId,
    });

    if (!tenant) {
      return res.status(404).render("error", {
        message: "Tenant not found or you do not have permission.",
      });
    }

    // Soft delete
    await SingleTenant.findByIdAndUpdate(tenantId, { status: "inactive" });

    // Close stay history
    await StayHistory.findOneAndUpdate(
      { tenant_ref_id: tenantId, status: "active" },
      { move_out_date: new Date(), status: "completed" }
    );

    // Redirect back to list
    res.redirect("/single");

  } catch (err) {
    console.error("POST /delete error:", err);
    res.status(500).render("error", { message: "Could not delete tenant." });
  }
});

// ════════════════════════════════════════
// ROUTE — SUCCESS PAGE
// ════════════════════════════════════════

app.get("/single/:tenantId/success", isAuth, async (req, res) => {
  try {
    const tenant = await SingleTenant.findById(req.params.tenantId);
    if (!tenant) return res.status(404).render("error", { message: "Tenant not found." });

    res.render("tenants/", {
      title     : "Tenant Registered",
      tenantId  : req.params.tenantId,
      tenantName: tenant.name,
    });
  } catch (err) {
    res.status(500).render("error", { message: "Something went wrong." });
  }
});

// ════════════════════════════════════════
// ADD THESE 2 THINGS TO YOUR app.js
// ════════════════════════════════════════

// ── STEP 1: Install and add method-override ──
// Run: npm install method-override
// Then add at top of app.js:
//
// const methodOverride = require("method-override");
// app.use(methodOverride("_method"));
//
// This allows HTML forms to send PUT requests
// by adding ?_method=PUT to the form action.
// Without this, HTML forms can only POST.


// ─────────────────────────────────────────
// GET /single/:tenantId/edit
// Open the edit form — pre-filled with
// current tenant data from MongoDB
// ─────────────────────────────────────────
app.get("/single/:tenantId/edit", isAuth, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const ownerId      = req.session.ownerId;

    // Fetch tenant — .lean() for Buffer support in EJS
    const tenant = await SingleTenant.findOne({
      _id     : tenantId,
      owner_id: ownerId,
    }).lean();

    if (!tenant) {
      return res.status(404).render("error", {
        message: "Tenant not found.",
      });
    }

    // Fetch existing ID proof to pre-fill the form
    const idProof = await SingleIdProof.findOne({
      tenant_id: tenantId,
    }).lean();

    res.render("tenants/singletenantedit", {
      title  : `Edit — ${tenant.name}`,
      tenant,
      idProof,  // null if no proof yet — EJS handles this
      errors : [],
    });

  } catch (err) {
    console.error("GET /edit error:", err);
    res.status(500).render("error", { message: "Could not load edit form." });
  }
});


// ─────────────────────────────────────────
// PUT /single/:tenantId
// Save updated tenant data to MongoDB
// Handles: text fields + optional new photos
// ─────────────────────────────────────────
app.put(
  "/single/:tenantId",
  isAuth,
  upload.fields([
    { name: "tenant_photo", maxCount: 1 },  // optional — only if new photo uploaded
    { name: "proof_image",  maxCount: 1 },  // optional — only if new proof uploaded
  ]),
  async (req, res) => {
    try {
      const { tenantId } = req.params;
      const ownerId      = req.session.ownerId;

      const {
        name,
        phone,
        occupation,
        permanent_address,
        id_proof_type,
        id_proof_number,
      } = req.body;

      // ── Validate ──
      const errors = [];
      if (!name?.trim())                errors.push({ msg: "Name is required" });
      if (!phone?.trim())               errors.push({ msg: "Phone is required" });
      if (phone && phone.length !== 10) errors.push({ msg: "Phone must be 10 digits" });
      if (!occupation?.trim())          errors.push({ msg: "Occupation is required" });
      if (!permanent_address?.trim())   errors.push({ msg: "Permanent address is required" });

      if (errors.length > 0) {
        // Re-fetch tenant and idProof to re-render form with errors
        const tenant  = await SingleTenant.findById(tenantId).lean();
        const idProof = await SingleIdProof.findOne({ tenant_id: tenantId }).lean();
        return res.render("tenants/edit", {
          title  : `Edit — ${tenant?.name}`,
          tenant,
          idProof,
          errors,
        });
      }

      // ── Build update object for tenant ──
      const tenantUpdate = {
        name             : name.trim(),
        phone            : phone.trim(),
        occupation       : occupation.trim(),
        permanent_address: permanent_address.trim(),
      };

      // Only update photo if a new file was uploaded
      const newPhotoFile = req.files?.tenant_photo?.[0];
      if (newPhotoFile) {
        tenantUpdate.tenant_photo = {
          data    : newPhotoFile.buffer,
          mimetype: newPhotoFile.mimetype,
          filename: newPhotoFile.originalname,
        };
      }

      // ── Update SingleTenant ──
      await SingleTenant.findOneAndUpdate(
        { _id: tenantId, owner_id: ownerId },  // security check
        tenantUpdate,
        { new: true }
      );

      // ── Update SingleIdProof if fields provided ──
      const newProofFile = req.files?.proof_image?.[0];
      const hasProofUpdate = id_proof_type || id_proof_number?.trim() || newProofFile;

      if (hasProofUpdate) {
        const proofUpdate = {};

        if (id_proof_type)          proofUpdate.id_proof_type   = id_proof_type;
        if (id_proof_number?.trim()) proofUpdate.id_proof_number = id_proof_number.trim();
        if (newProofFile) {
          proofUpdate.proof_image = {
            data    : newProofFile.buffer,
            mimetype: newProofFile.mimetype,
            filename: newProofFile.originalname,
          };
        }

        // Update existing proof OR create new one if not exists
        await SingleIdProof.findOneAndUpdate(
          { tenant_id: tenantId },
          proofUpdate,
          { upsert: true, new: true }  // upsert = create if not found
        );
      }

      // ── Redirect to detail page ──
      res.redirect(`/single/${tenantId}/detail`);

    } catch (err) {
      console.error("PUT /single/:tenantId error:", err);
      res.status(500).render("error", { message: "Could not save changes." });
    }
  }
);  


// ════════════════════════════════════════════════════════
// FAMILY ROUTES — add all of these to your app.js
// ════════════════════════════════════════════════════════


// ─────────────────────────────────────────
// GET /family
// List all families for logged-in owner
// ─────────────────────────────────────────
app.get("/family", isAuth, async (req, res) => {
  try {
    const families = await FamilyHead
      .find({ owner_id: req.session.ownerId })
      .sort({ createdAt: -1 })
      .lean();

    res.render("family/family-list", {
      title   : "Family Tenants",
      families,
    });
  } catch (err) {
    console.error("GET /family error:", err);
    res.status(500).render("error", { message: "Could not load families." });
  }
});


// ─────────────────────────────────────────
// GET /family/add
// Open Add Family Head form
// ─────────────────────────────────────────
app.get("owners/family/add", isAuth, (req, res) => {
  res.render("family/add-family-head", {
    title   : "Add Family Head",
    errors  : [],
    formData: {},
  });
});


// ─────────────────────────────────────────
// POST /family/add
// Save family head to MongoDB
// ─────────────────────────────────────────
app.post(
  "/family/add",
  isAuth,
  upload.fields([{ name: "head_photo", maxCount: 1 }]),
  async (req, res) => {
    try {
      const ownerId = req.session.ownerId;
      const { head_name, phone, occupation, permanent_address, live_photo_base64 } = req.body;
      const headPhotoFile = req.files?.head_photo?.[0];

      // Validate
      const errors = [];
      if (!head_name?.trim())           errors.push({ msg: "Name is required" });
      if (!phone?.trim())               errors.push({ msg: "Phone is required" });
      if (phone && phone.length !== 10) errors.push({ msg: "Phone must be 10 digits" });
      if (!occupation?.trim())          errors.push({ msg: "Occupation is required" });
      if (!permanent_address?.trim())   errors.push({ msg: "Address is required" });
      if (!headPhotoFile)               errors.push({ msg: "Head photo is required" });
      if (!live_photo_base64)           errors.push({ msg: "Live photo capture is required" });

      if (errors.length > 0) {
        return res.render("family/add-head", {
          title   : "Add Family Head",
          errors,
          formData: { head_name, phone, occupation, permanent_address },
        });
      }

      // Save FamilyHead
      const family = await FamilyHead.create({
        owner_id         : ownerId,
        head_name        : head_name.trim(),
        phone            : phone.trim(),
        occupation       : occupation.trim(),
        permanent_address: permanent_address.trim(),
        head_photo: {
          data    : headPhotoFile.buffer,
          mimetype: headPhotoFile.mimetype,
          filename: headPhotoFile.originalname,
        },
        live_photo: {
          data       : base64ToBuffer(live_photo_base64),
          mimetype   : "image/jpeg",
          captured_at: new Date(),
        },
        total_members: 0,
      });

      // Redirect to ID proof
      res.redirect(`/family/${family._id}/id-proof`);

    } catch (err) {
      console.error("POST /family/add error:", err);
      res.status(500).render("error", { message: "Could not save family head." });
    }
  }
);


// ─────────────────────────────────────────
// GET /family/:familyId/id-proof
// Open family ID proof form
// ─────────────────────────────────────────
app.get("/family/:familyId/id-proof", isAuth, async (req, res) => {
  try {
    const family = await FamilyHead.findById(req.params.familyId).lean();
    if (!family) return res.status(404).render("error", { message: "Family not found." });

    res.render("family/family-id-proof", {
      title   : "Family ID Proof",
      familyId: req.params.familyId,
      headName: family.head_name,
      errors  : [],
      formData: {},
    });
  } catch (err) {
    res.status(500).render("error", { message: "Something went wrong." });
  }
});


// ─────────────────────────────────────────
// POST /family/:familyId/id-proof
// Save family ID proof
// ─────────────────────────────────────────
app.post(
  "/family/:familyId/id-proof",
  isAuth,
  upload.fields([{ name: "proof_image", maxCount: 1 }]),
  async (req, res) => {
    try {
      const { familyId } = req.params;
      const { id_proof_type, id_proof_number } = req.body;
      const proofFile = req.files?.proof_image?.[0];

      const errors = [];
      if (!id_proof_type)           errors.push({ msg: "Please select ID proof type" });
      if (!id_proof_number?.trim()) errors.push({ msg: "ID proof number is required" });
      if (!proofFile)               errors.push({ msg: "Please upload proof image" });

      if (errors.length > 0) {
        const family = await FamilyHead.findById(familyId).lean();
        return res.render("family/family-id-proof", {
          title   : "Family ID Proof",
          familyId,
          headName: family?.head_name || "",
          errors,
          formData: { id_proof_type, id_proof_number },
        });
      }

      await FamilyIdProof.create({
        family_id      : familyId,
        id_proof_type,
        id_proof_number: id_proof_number.trim(),
        proof_image: {
          data    : proofFile.buffer,
          mimetype: proofFile.mimetype,
          filename: proofFile.originalname,
        },
        uploaded_at: new Date(),
      });

      // Redirect to family detail page
      res.redirect(`/family/${familyId}/detail`);

    } catch (err) {
      console.error("POST /family/id-proof error:", err);
      res.status(500).render("error", { message: "Could not save ID proof." });
    }
  }
);


// ─────────────────────────────────────────
// GET /family/:familyId/detail
// Family detail page — head + all members
// ─────────────────────────────────────────
app.get("/family/:familyId/detail", isAuth, async (req, res) => {
  try {
    const { familyId } = req.params;
    const ownerId      = req.session.ownerId;

    const head = await FamilyHead.findOne({
      _id     : familyId,
      owner_id: ownerId,
    }).lean();

    if (!head) return res.status(404).render("error", { message: "Family not found." });

    const idProof = await FamilyIdProof.findOne({ family_id: familyId }).lean();
    const members = await FamilyMember.find({ family_id: familyId }).lean();

    res.render("family/family-detail", {
      title  : `${head.head_name}'s Family`,
      head,
      idProof,
      members,
    });
  } catch (err) {
    console.error("GET /family/detail error:", err);
    res.status(500).render("error", { message: "Could not load family." });
  }
});


// ─────────────────────────────────────────
// GET /family/:familyId/members/add
// Open Add Member form
// ─────────────────────────────────────────
app.get("/family/:familyId/members/add", isAuth, async (req, res) => {
  try {
    const { familyId } = req.params;
    const family = await FamilyHead.findById(familyId).lean();
    if (!family) return res.status(404).render("error", { message: "Family not found." });

    res.render("family/add-member", {
      title   : "Add Family Member",
      familyId,
      headName: family.head_name,
      errors  : [],
      formData: {},
    });
  } catch (err) {
    res.status(500).render("error", { message: "Something went wrong." });
  }
});


// ─────────────────────────────────────────
// POST /family/:familyId/members/add
// Save new family member
// ─────────────────────────────────────────
app.post(
  "/family/:familyId/members/add",
  isAuth,
  upload.fields([{ name: "member_photo", maxCount: 1 }]),
  async (req, res) => {
    try {
      const { familyId } = req.params;
      const { name, age, relation, occupation, phone } = req.body;
      const memberPhotoFile = req.files?.member_photo?.[0];

      // Validate
      const errors = [];
      if (!name?.trim())  errors.push({ msg: "Member name is required" });
      if (!age)           errors.push({ msg: "Age is required" });
      if (!relation)      errors.push({ msg: "Relation is required" });

      if (errors.length > 0) {
        const family = await FamilyHead.findById(familyId).lean();
        return res.render("family/add-member", {
          title   : "Add Family Member",
          familyId,
          headName: family?.head_name || "",
          errors,
          formData: { name, age, relation, occupation, phone },
        });
      }

      // Build member object
      const memberData = {
        family_id : familyId,
        name      : name.trim(),
        age       : Number(age),
        relation,
        occupation: occupation?.trim() || "Not specified",
        phone     : phone?.trim() || "",
      };

      // Add photo only if uploaded
      if (memberPhotoFile) {
        memberData.member_photo = {
          data    : memberPhotoFile.buffer,
          mimetype: memberPhotoFile.mimetype,
          filename: memberPhotoFile.originalname,
        };
      }

      await FamilyMember.create(memberData);

      // Increment total_members on family head
      await FamilyHead.findByIdAndUpdate(familyId, {
        $inc: { total_members: 1 },
      });

      // Redirect back to family detail
      res.redirect(`/family/${familyId}/detail`);

    } catch (err) {
      console.error("POST /members/add error:", err);
      res.status(500).render("error", { message: "Could not save member." });
    }
  }
);


// ─────────────────────────────────────────
// POST /family/:familyId/members/:memberId/delete
// Remove a member from family
// ─────────────────────────────────────────
app.post("/family/:familyId/members/:memberId/delete", isAuth, async (req, res) => {
  try {
    const { familyId, memberId } = req.params;

    await FamilyMember.findByIdAndDelete(memberId);

    // Decrement total_members
    await FamilyHead.findByIdAndUpdate(familyId, {
      $inc: { total_members: -1 },
    });

    res.redirect(`/family/${familyId}/detail`);

  } catch (err) {
    console.error("POST /members/delete error:", err);
    res.status(500).render("error", { message: "Could not remove member." });
  }
});


// ─────────────────────────────────────────
// POST /family/:familyId/delete
// Soft delete entire family
// ─────────────────────────────────────────
app.post("/family/:familyId/delete", isAuth, async (req, res) => {
  try {
    const { familyId } = req.params;
    const ownerId      = req.session.ownerId;

    const family = await FamilyHead.findOne({ _id: familyId, owner_id: ownerId });
    if (!family) return res.status(404).render("error", { message: "Family not found." });

    await FamilyHead.findByIdAndUpdate(familyId, { status: "inactive" });

    res.redirect("/family");

  } catch (err) {
    console.error("POST /family/delete error:", err);
    res.status(500).render("error", { message: "Could not delete family." });
  }
});

// ════════════════════════════════════════
// ERROR PAGE
// ════════════════════════════════════════
app.use((req, res) => {
  res.status(404).render("error", { message: "Page not found." });
});

// ════════════════════════════════════════
// START SERVER
// ════════════════════════════════════════
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});