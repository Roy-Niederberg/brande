import fs from 'fs'
import express from 'express'
const app = express();
app.use(express.json());

// =============== Util Functions ====================================================================================//

const read_scrt = name => fs.readFileSync(`/run/secrets/${name}`, 'utf-8').trim()
const LOG = (num, e) => { console.log(`🚨 ERROR ${num} 🚨 : ${e}`); return true }

// Serve static files (html, css, js) from the 'public' directory
app.use(express.static('public'));

// =============== Server Loading section ============================================================================//
// In this section the server should fail in case of error and not startup. ==========================================//

const app_id  = read_scrt('fb_global_app_id')
app_id.length > 0 || LOG(0, 'App Id is empty.')
const app_secret = read_scrt('fb_global_app_secret')
app_secret.length > 0 || LOG(0, 'App Secret Token is empty.')

// =============== Endpoints =========================================================================================//
// In this section the server should keep running and give the best answer it can. ===================================//
//
app.post('/api/get-permanent-tokens', async (req, res) => {
    const { shortLivedToken } = req.body;

    if (!shortLivedToken) {
        return res.status(400).json({ error: 'Token is missing' });
    }

    try {
        // 1. Exchange Short-Lived User Token for Long-Lived User Token (60 days)
        const exchangeUrl = `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${app_id}&client_secret=${app_secret}&fb_exchange_token=${shortLivedToken}`;

        const exchangeResponse = await fetch(exchangeUrl);
        const exchangeData = await exchangeResponse.json();

        if (exchangeData.error) throw new Error(exchangeData.error.message);

        const longLivedUserToken = exchangeData.access_token;

        // 2. Use Long-Lived User Token to get Page Tokens
        // Because we use a long-lived user token, these page tokens are permanent/indefinite.
        const accountsUrl = `https://graph.facebook.com/v24.0/me/accounts?access_token=${longLivedUserToken}`;

        const accountsResponse = await fetch(accountsUrl);
        const accountsData = await accountsResponse.json();

        if (accountsData.error) throw new Error(accountsData.error.message);

        // 3. Send the list of pages and their permanent tokens back to frontend
        res.json({
            success: true,
            pages: accountsData.data.map(page => ({
                name: page.name,
                id: page.id,
                permanent_token: page.access_token
            }))
        });

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(8558, () => console.log('Brande Site Service Started'))
