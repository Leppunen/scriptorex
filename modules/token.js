/* eslint-disable camelcase */
module.exports.check = async () => {
    let token = await sc.Utils.cache.get('oauth-token');
    if (!token) {
        sc.Logger.warn('Token has expired. Refreshing the token.');
        await fetchToken();
        token = await sc.Utils.cache.get('oauth-token');
    }
    try {
        await sc.Utils.got.twitchAuth('oauth2/validate', {headers: {'Authorization': `OAuth ${token}`}}).json();
    } catch (error) {
        if (error instanceof sc.Utils.got.twitchAuth.HTTPError) {
            sc.Logger.warn('Got an unexpected return code. Assuming the token is invalid. Will create a new token.');
            await fetchToken();
        }
        sc.Logger.error(`Error checking token: ${error}`);
    }
    sc.Data.oauthToken = token;
};


const fetchToken = async () => {
    const refreshToken = await sc.Utils.cache.get('refresh-token');
    if (!refreshToken) {
        sc.Logger.warn('No refresh token present. Cannot create a token.');
    }
    try {
        const {access_token, expires_in, refresh_token} = await sc.Utils.got.twitchAuth.post('oauth2/token', {
            searchParams: {
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: sc.Config.twitch.clientid,
                client_secret: sc.Config.twitch.clientsecret,
            },
        }).json();
        await sc.Utils.cache.set('oauth-token', access_token, expiry = expires_in);
        await sc.Utils.cache.set('refresh-token', refresh_token, expiry = 0);
    } catch (e) {
        if (e instanceof sc.Utils.got.twitchAuth.HTTPError) {
            sc.Logger.json(e.response.body);
        } else {
            sc.Logger.debug(e);
        }
    }
};

setInterval(async () => {
    await this.check();
}, 60000);
