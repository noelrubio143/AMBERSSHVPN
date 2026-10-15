// Device IDs that always get full access (shared by user-status and game-win).
const ADMIN_USER_IDS = [
  '7550dd01-e223-491e-acb3-43fe8f4e3d2b',
];

// Basic sanity check for a device id coming from the app.
function validUserId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(id);
}

// Calendar day in the Philippines (YYYY-MM-DD) - the daily bonus resets at
// midnight PH time, using the SERVER clock, never the phone's clock.
function manilaDay(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(date);
}

module.exports = { ADMIN_USER_IDS, validUserId, manilaDay };
