const express = require('express');
const axios = require('axios');
const cors = require('cors');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');  // ✅ Rate limiter

const app = express();
const port = process.env.PORT;

// ✅ Apply CORS
app.use(cors());

// ✅ Apply rate limiting middleware
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// ✅ ENV variables
const NEXUDUS_API_USERNAME = process.env.NEXUDUS_API_USERNAME;
const NEXUDUS_API_PASSWORD = process.env.NEXUDUS_API_PASSWORD;
const NEXUDUS_SHARED_SECRET = process.env.NEXUDUS_SHARED_SECRET;

// ✅ Hash verification function
function isValidHash(userid, providedHash) {
    const stringToSign = String(userid).trim();
    const hmac = crypto.createHmac('sha256', NEXUDUS_SHARED_SECRET);
    hmac.update(stringToSign);
    const calculatedHash = hmac.digest('hex');

    // Debug logs (optional - disable when live)
    console.log("UserID:", stringToSign);
    console.log("Calculated Hash:", calculatedHash);
    console.log("Provided Hash:", providedHash);

    return calculatedHash === providedHash;
}

app.get('/api/get-bookings', async (req, res) => {
    const { userid, hash } = req.query;

    // ✅ Input validation
    if (!userid || !hash) {
        return res.status(400).json({ error: 'Missing userid or hash parameter.' });
    }
    if (!/^\d+$/.test(userid)) {
        return res.status(400).json({ error: 'Invalid userid format.' });
    }

    // ✅ Verify hash
    if (!isValidHash(userid, hash)) {
        console.error('Invalid hash signature.');
        return res.status(403).json({ error: 'Invalid signature.' });
    }

    try {
        // ✅ SAFER: coworkerid instead of customerid
        const bookingsRes = await axios.get(
            `https://spaces.nexudus.com/api/spaces/bookings?coworkerid=${userid}&fromdate=${new Date().toISOString()}&status=Confirmed`,
            {
                auth: {
                    username: NEXUDUS_API_USERNAME,
                    password: NEXUDUS_API_PASSWORD
                }
            }
        );

        res.json({ bookings: bookingsRes.data.Records });
    } catch (err) {
        console.error("Error calling Nexudus API:", err?.response?.data || err.message);
        res.status(500).json({ error: 'Failed to retrieve bookings.' });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
