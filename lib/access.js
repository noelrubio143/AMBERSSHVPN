// Device IDs that always get full access (used by user-status).
const ADMIN_USER_IDS = [
  '7550dd01-e223-491e-acb3-43fe8f4e3d2b',
];

// Basic sanity check for a device id coming from the app.
function validUserId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(id);
}

module.exports = { ADMIN_USER_IDS, validUserId };
