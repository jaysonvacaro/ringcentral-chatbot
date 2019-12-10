"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _express = _interopRequireDefault(require("express"));

var _expressBasicAuth = _interopRequireDefault(require("express-basic-auth"));

var _models = require("../models");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const createApp = handle => {
  const app = (0, _express.default)();
  app.use((0, _expressBasicAuth.default)({
    users: {
      [process.env.RINGCENTRAL_CHATBOT_ADMIN_USERNAME]: process.env.RINGCENTRAL_CHATBOT_ADMIN_PASSWORD
    },
    unauthorizedResponse: req => '401 Unauthorized'
  })); // create database tables if not exists

  app.put('/setup-database', async (req, res) => {
    await _models.Bot.sync();
    await _models.Service.sync();
    await handle({
      type: 'SetupDatabase'
    });
    res.send('');
  }); // "maintain": remove dead bots from database, ensure live bots have WebHooks

  app.put('/maintain', async (req, res) => {
    const bots = await _models.Bot.findAll();

    for (const bot of bots) {
      if (await bot.check()) {
        await bot.ensureWebHook();
      }
    }

    const services = await _models.Service.findAll();

    for (const service of services) {
      await service.check();
    }

    await handle({
      type: 'Maintain'
    });
    res.send('');
  }); // provide administrator with diagnostic information for troubleshooting

  app.get('/diagnostic', async (req, res) => {
    const bots = await _models.Bot.findAll();
    let result = '';

    for (const bot of bots) {
      result += '*****************\n';
      result += `<pre>\n${JSON.stringify(bot, null, 2)}\n</pre>\n`;
      const subscriptions = await bot.getSubscriptions();
      result += `<pre>\n${JSON.stringify(subscriptions, null, 2)}\n</pre>\n`;
      result += '*****************\n';
    }

    result += '\n<hr/>\n\n';
    const services = await _models.Service.findAll();

    for (const service of services) {
      result += `<pre>\n${JSON.stringify(service, null, 2)}}\n</pre>\n`;
    }

    res.send(result);
  });
  return app;
};

var _default = createApp;
exports.default = _default;
//# sourceMappingURL=admin.js.map