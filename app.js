const express= require("express");
const mongoose= require("mongoose");
const path= require("path");
const multer= require("multer");
const bcrypt= require("bcryptjs");
const session= require("express-session");
const MongoStore   = require("connect-mongo").default;
require("dotenv").config();

const Owner         = require("./models/owner");
const SingleTenant  = require("./models/singletenant");
const SingleIdProof = require("./models/singleidProof");
const StayHistory   = require("./models/stayhistory");
const isAuth        = require("./middleware/isAuth");

const app = express();

// ════════════════════════════════════════
// MIDDLEWARE
// ════════════════════════════════════════
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
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