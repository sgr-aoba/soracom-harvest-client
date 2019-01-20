const rp = require('request-promise-native');
const util = require('util');
const getUsage = require('command-line-usage');
const commandLineArgs = require('command-line-args');

const optionList = [
  {
    name: 'authkey_id',
    alias: 'i',
    type: String,
    typeLabel: 'keyId-XXXXXXXXXXXXXXXXX',
    description: 'AuthKeyId of SORACOM SAM user'
  },
  {
    name: 'authkey_secret',
    alias: 's',
    type: String,
    typeLabel: 'secret-XXXXXXXXXXXXXXXX',
    description: 'AuthKey secret of SORACOM SAM user'
  }
];
const sections = [
  {
    header: 'soracom-client',
    content: 'SORACOM Harvest data downloader'
  },
  {
    header: 'Options',
    optionList: optionList
  }
];

const auth = async (authKeyId, authKey) => {
  return rp({
    method: 'POST',
    uri: 'https://api.soracom.io/v1/auth',
    body: {
      authKeyId: authKeyId,
      authKey: authKey
    },
    json: true
  });
};

const api_get = async (api_key, api_token, uri) => {
  return rp({
    method: 'GET',
    uri: uri,
    headers: {
      'X-Soracom-API-Key': api_key,
      'X-Soracom-Token': api_token
    },
    json: true
  });
};

const subscribers = async (api_key, api_token) => {
  return api_get(api_key, api_token, 'https://api.soracom.io/v1/subscribers');
};

const subscriber_data = async (api_key, api_token, imsi) => {
  return api_get(api_key, api_token, util.format('https://api.soracom.io/v1/subscribers/%s/data', imsi));
};

const main = async () => {
  try {
    let options = commandLineArgs(optionList);
    let usage = getUsage(sections);
    if (options.help) {
      console.log(usage);
      process.exit(0);
    } else if (!options['authkey_id'] || !options['authkey_secret']) {
      console.error('lack of mandatory option: (%s, %s)', options['authkey_id'], options['authkey_secret']);
      console.error(usage);
      process.exit(1);
    }

    let result = await auth(options['authkey_id'], options['authkey_secret'])
    .then(async ({ apiKey, operatorId, token }) => {
      //console.log('apiKey: %s, operatorId: %s, token: %s', apiKey, operatorId, token);
      let sims = await subscribers(apiKey, token);
      //console.log('sims: %j', sims);
      return Promise.all(sims.map(sim => {
        return subscriber_data(apiKey, token, sim['imsi'])
        .then(data => {
          return data.map(d => {
            let content = JSON.parse(d['content']);
            d['content'] = JSON.parse(Buffer.from(content['payload'], 'base64').toString('ascii'));
            return d;
          });
        });
      }));
    });

    console.log('result: %j', result);
    process.exitCode = 0;
  } catch (err) {
    console.error('main error: ', err);
    process.exitCode = 1;
  }
};

main();