const express = require('express');
const axios = require('axios');
const cors = require('cors');
const crypto = require('crypto');  // Added for hash verification

const app = express();
const port = process.env.PORT;

app.use(cors());

// ENV variables
const NEXUDUS_API_USERNAME = process.env.NEXUDUS_API_USERNAME;
const NEXUDUS_API_PASSWORD = process.env.NEXUDUS_API_PASSWORD;
const NEXUDUS_SHARED_SECRET = process.env.NEXUDUS_SHARED_SECRET;  // New shared secret

// Function to verify the hash signature
function isValidHash(fullUrl, providedHash) {
    // Remove the hash param from the URL before verifying
    const urlWithoutHash = fullUrl.replace(/([?&]hash=[^&]*)/, '');
    const hmac = crypto.createHmac('sha256', NEXUDUS_SHARED_SECRET);
    hmac.update(urlWithoutHash);
    const calculatedHash = hmac.digest('hex');
    return calculatedHash === providedHash;
}

app.get('/api/get-bookings', async (req, res) => {
    const { userid, hash } = req.query;

    if (!userid || !hash) {
        return res.json({ error: 'Missing userid or hash parameter.' });
    }

    // Full URL (including protocol & host)
    const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;

    // Verify hash
    if (!isValidHash(fullUrl, hash)) {
        console.error('Invalid hash signature.');
        return res.json({ error: 'Invalid signature.' });
    }

    try {
        const bookingsRes = await axios.get(
            `https://spaces.nexudus.com/api/spaces/bookings?customerid=${userid}&fromdate=${new Date().toISOString()}&status=Confirmed`, 
            {
                auth: {
                    username: NEXUDUS_API_USERNAME,
                    password: NEXUDUS_API_PASSWORD
                }
            }
        );

        res.json({ bookings: bookingsRes.data.Records });
    } catch (err) {
        if (err.response) {
            console.error("Nexudus API Error Response:", err.response.data);
            console.error("Status Code:", err.response.status);
            console.error("Headers:", err.response.headers);
        } else {
            console.error("Error:", err.message);
        }
        res.json({ error: 'Failed to retrieve bookings.' });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});


