const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = process.env.PORT;

app.use(cors());

// ENV variables
const NEXUDUS_API_USERNAME = process.env.NEXUDUS_API_USERNAME;
const NEXUDUS_API_PASSWORD = process.env.NEXUDUS_API_PASSWORD;

app.get('/api/get-bookings', async (req, res) => {
    const { userid } = req.query;

    if (!userid) {
        return res.json({ error: 'Missing userID parameter.' });
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
    console.error("Error response data:", err.response?.data);
    console.error("Error full object:", err);
    res.json({ error: 'Failed to retrieve bookings.' });
}

});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

