"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Bot = void 0;

var _sequelize = _interopRequireDefault(require("sequelize"));

var _ringcentralJsConcise = _interopRequireDefault(require("ringcentral-js-concise"));

var _timeoutAsPromise = _interopRequireDefault(require("timeout-as-promise"));

var _formData = _interopRequireDefault(require("form-data"));

var _sequelize2 = _interopRequireDefault(require("./sequelize"));

var _Service = require("./Service");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const Bot = _sequelize2.default.define('bot', {
  id: {
    type: _sequelize.default.STRING,
    primaryKey: true
  },
  token: {
    type: _sequelize.default.JSON
  }
});

exports.Bot = Bot;

Bot.init = async ({
  code,
  token
}) => {
  const rc = new _ringcentralJsConcise.default(process.env.RINGCENTRAL_CHATBOT_CLIENT_ID, process.env.RINGCENTRAL_CHATBOT_CLIENT_SECRET, process.env.RINGCENTRAL_SERVER);

  if (code) {
    // public bot
    await rc.authorize({
      code,
      redirectUri: process.env.RINGCENTRAL_CHATBOT_SERVER + '/bot/oauth'
    });
    const token = rc.token();
    /*
    {
      access_token: 'xxxxxx',
      token_type: 'bearer',
      expires_in: 2147483647,
      scope: 'EditExtensions SubscriptionWebhook Glip Accounts',
      owner_id: '266262004',
      endpoint_id: 'p7GZlEVHRwKDwbx6UkH0YQ'
    }
    */

    return Bot.create({
      id: token.owner_id,
      token
    });
  } else if (token) {
    // private bot

    /*
    {
      access_token: 'xxxxxx',
      creator_extension_id: '230919004',
      creator_account_id: '230919004',
      client_id: 'zNzIRgPiSbylEoW89Daffg'
    }
    */
    rc.token(token);
    const r = await rc.get('/restapi/v1.0/account/~/extension/~');
    const id = r.data.id.toString();
    return Bot.create({
      id,
      token: { ...token,
        owner_id: id
      }
    });
  }
};

Object.defineProperty(Bot.prototype, 'rc', {
  get: function () {
    const rc = new _ringcentralJsConcise.default(process.env.RINGCENTRAL_CHATBOT_CLIENT_ID, process.env.RINGCENTRAL_CHATBOT_CLIENT_SECRET, process.env.RINGCENTRAL_SERVER);
    rc.token(this.token);
    return rc;
  }
});

Bot.prototype.check = async function () {
  try {
    await this.rc.get('/restapi/v1.0/account/~/extension/~');
    return true;
  } catch (e) {
    if (!e.data) {
      throw e;
    }

    const errorCode = e.data.errorCode;

    if (errorCode === 'OAU-232' || errorCode === 'CMN-405') {
      await this.remove();
      console.log(`Bot check: bot user ${this.id} had been deleted`);
      return false;
    }

    throw e;
  }
};

Bot.prototype.ensureWebHook = async function () {
  const r = await this.rc.get('/restapi/v1.0/subscription');
  let hasActiveSub = false;
  const subs = r.data.records.filter(sub => sub.deliveryMode.address === process.env.RINGCENTRAL_CHATBOT_SERVER + '/bot/webhook');

  for (const sub of subs) {
    if (hasActiveSub || sub.status !== 'Active') {
      await this.rc.delete(`/restapi/v1.0/subscription/${sub.id}`);
    } else {
      hasActiveSub = true;
    }
  }

  if (!hasActiveSub) {
    await this.setupWebHook();
  }
};

Bot.prototype.setupWebHook = async function () {
  let done = false;

  while (!done) {
    try {
      await this.rc.post('/restapi/v1.0/subscription', {
        eventFilters: ['/restapi/v1.0/glip/posts', '/restapi/v1.0/glip/groups', '/restapi/v1.0/account/~/extension/~'],
        expiresIn: 473040000,
        // 15 years
        deliveryMode: {
          transportType: 'WebHook',
          address: process.env.RINGCENTRAL_CHATBOT_SERVER + '/bot/webhook'
        }
      });
      done = true;
    } catch (e) {
      const errorCode = e.data.errorCode;

      if (errorCode === 'SUB-406') {
        await (0, _timeoutAsPromise.default)(10000);
        continue;
      }

      throw e;
    }
  }
};

Bot.prototype.sendMessage = async function (groupId, messageObj) {
  const r = await this.rc.post(`/restapi/v1.0/glip/groups/${groupId}/posts`, messageObj);
  return r.data;
};

Bot.prototype.getGroup = async function (groupId) {
  try {
    const r = await this.rc.get(`/restapi/v1.0/glip/groups/${groupId}`);
    return r.data;
  } catch (e) {
    if (e.status === 404) {
      return undefined;
    }

    throw e;
  }
};

Bot.prototype.remove = async function () {
  const services = await _Service.Service.findAll({
    where: {
      botId: this.id
    }
  });

  for (const service of services) {
    await service.destroy();
  }

  await this.destroy();
};

Bot.prototype.rename = async function (newName) {
  await this.rc.put('/restapi/v1.0/account/~/extension/~', {
    contact: {
      firstName: newName
    }
  });
};

Bot.prototype.setAvatar = async function (data, name) {
  const formData = new _formData.default();
  formData.append('image', data, name);
  await this.rc.put('/restapi/v1.0/account/~/extension/~/profile-image', formData, {
    headers: formData.getHeaders()
  });
};

Bot.prototype.getUser = async function (userId) {
  let r = await this.rc.get(`/restapi/v1.0/glip/persons/${userId}`);
  const glip = r.data;
  let rc;

  if (!glip.id.startsWith('glip-')) {
    r = await this.rc.get(`/restapi/v1.0/account/${glip.companyId}/extension/${glip.id}`);
    rc = r.data;
  }

  return {
    glip,
    rc
  };
};

Bot.prototype.getSubscriptions = async function () {
  const r = await this.rc.get('/restapi/v1.0/subscription');
  return r.data.records;
};
//# sourceMappingURL=Bot.js.map