// middleware/isAuth.js
// Protects routes — if no session, redirect to login

const isAuth = (req, res, next) => {
  if (req.session && req.session.ownerId) {
    // Session exists — allow request to continue
    next();
  } else {
    // No session — send to login page
    res.redirect("/login");
  }
};

module.exports = isAuth;