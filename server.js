const express = require('express');
const axios = require('axios');
const cors = require('cors');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const app = express();
const port = process.env.PORT;

app.use(cors());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// ENV variables
const NEXUDUS_API_USERNAME = process.env.NEXUDUS_API_USERNAME;
const NEXUDUS_API_PASSWORD = process.env.NEXUDUS_API_PASSWORD;
const NEXUDUS_SHARED_SECRET = process.env.NEXUDUS_SHARED_SECRET;

// Verify hash signature
function isValidHash(userid, providedHash) {
    const stringToSign = String(userid).trim();
    const hmac = crypto.createHmac('sha256', NEXUDUS_SHARED_SECRET);
    hmac.update(stringToSign);
    const calculatedHash = hmac.digest('hex');

    // ✅ LOGGING for debugging:
    console.log("Validating request:");
    console.log("UserID:", stringToSign);
    console.log("Provided Hash:", providedHash);
    console.log("Calculated Hash:", calculatedHash);

    return calculatedHash === providedHash;
}

// Helper to format date in strict ISO format for Nexudus (removes milliseconds)
function toISOStringNoMillis(date) {
    return date.toISOString().split('.')[0] + 'Z';
}

app.get('/api/get-bookings', async (req, res) => {
    const { userid, hash } = req.query;

    if (!userid || !hash) {
        return res.status(400).json({ error: 'Missing userid or hash parameter.' });
    }
    if (!/^\d+$/.test(userid)) {
        return res.status(400).json({ error: 'Invalid userid format.' });
    }
    if (!isValidHash(userid, hash)) {
        console.error('Invalid hash signature.');
        return res.status(403).json({ error: 'Invalid signature.' });
    }

    try {
        // STEP 1: Get CoworkerId from UserId
        const coworkerRes = await axios.get(
            `https://spaces.nexudus.com/api/billing/coworkers?Coworker_User=${userid}`,
            {
                auth: {
                    username: NEXUDUS_API_USERNAME,
                    password: NEXUDUS_API_PASSWORD
                }
            }
        );

        if (!coworkerRes.data.Records || coworkerRes.data.Records.length === 0) {
            console.log("No coworker found for userID:", userid);
            return res.json({ bookings: [] });
        }

        const coworkerId = coworkerRes.data.Records[0].Id;
        console.log("CoworkerID found:", coworkerId);

        // STEP 2: Query today's bookings for this coworker
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

        const bookingsUrl = `https://spaces.nexudus.com/api/spaces/bookings?Booking_Coworker=${coworkerId}&from_Booking_FromTime=${toISOStringNoMillis(startOfDay)}&to_Booking_ToTime=${toISOStringNoMillis(endOfDay)}&status=Confirmed`;

        console.log("Bookings request URL:", bookingsUrl);

        const bookingsRes = await axios.get(bookingsUrl, {
            auth: {
                username: NEXUDUS_API_USERNAME,
                password: NEXUDUS_API_PASSWORD
            }
        });

        console.log("Bookings returned:", bookingsRes.data.Records.length);
        res.json({ bookings: bookingsRes.data.Records });

    } catch (err) {
        console.error("Error calling Nexudus API:", err?.response?.data || err.message);
        res.status(500).json({ error: 'Failed to retrieve bookings.' });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
