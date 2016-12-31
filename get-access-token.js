const UpworkApi = require('upwork-api');
const Auth = require('upwork-api/lib/routers/auth').Auth;
const rl = require('readline');

const config = {
  'consumerKey' : process.env.UPWORK_CONSUMER_KEY,
  'consumerSecret' : process.env.UPWORK_CONSUMER_SECRET,
  'accessToken' : process.env.UPWORK_ACCESS_TOKEN, // assign if known
  'accessSecret' : process.env.UPWORK_ACCESS_SECRET, // assign if known
  'debug' : process.env.UPWORK_DEBUG || false
};

function getUserData(api, callback) {
  // make a call
  var auth = new Auth(api);
  auth.getUserInfo(function(error, data) {
    // check error if needed and run your own error handler
    callback(error, data);
  });
}

function getAccessTokenSecretPair(api, callback) {
  // get authorization url
  api.getAuthorizationUrl(
    'http://localhost/complete',
    (error, url, requestToken, requestTokenSecret) => {
      if (error) {
        throw new Error(`can not get authorization url, error: ${error}`);
      }
      debug(requestToken, 'got a request token');
      debug(requestTokenSecret, 'got a request token secret');

      // authorize application
      const i = rl.createInterface(process.stdin, process.stdout);
      const question = `Please, visit an url ${url} and enter a verifier: `;
      i.question(question, (verifier) => {
        i.close();
        process.stdin.destroy();
        debug(verifier, 'entered verifier is');

        // get access token/secret pair
        api.getAccessToken(
          requestToken,
          requestTokenSecret,
          verifier,
          (error, accessToken, accessTokenSecret) => {
            if (error) throw new Error(error);

            debug(accessToken, 'got an access token');
            debug(accessTokenSecret, 'got an access token secret');

            callback(accessToken, accessTokenSecret);
          }
        );
      });
    }
  );
};

const api = new UpworkApi(config);

if (!config.accessToken || !config.accessSecret) {
  // run authorization in case we haven't done it yet
  // and do not have an access token-secret pair
  getAccessTokenSecretPair(api, (accessToken, accessTokenSecret) => {
    debug(accessToken, 'current token is');
    // store access token data in safe place!

    // get my auth data
    getUserData(api, (error, data) => {
      debug(data, 'response');
      console.log(`Hello: ${data.auth_user.first_name}`);
    });
  });
} else {
  // setup access token/secret pair in case it is already known
  api.setAccessToken(config.accessToken, config.accessSecret, () => {
    // get my auth data
    getUserData(api, function(error, data) {
      debug(data, 'response');
      // server_time
      console.log(`Hello: ${data.auth_user.first_name}`);
    });
  });
}
