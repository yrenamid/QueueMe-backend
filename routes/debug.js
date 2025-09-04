const express = require('express');
const router = express.Router();

// Public debug endpoint to echo origin and request headers for troubleshooting CORS
router.get('/origin', (req, res) => {
  return res.json({
    success: true,
    origin: req.get('origin') || null,
    headers: {
      originHeader: req.headers['origin'] || null,
      referer: req.headers['referer'] || null,
      host: req.headers['host'] || null,
      userAgent: req.headers['user-agent'] || null,
    }
  });
});

module.exports = router;
