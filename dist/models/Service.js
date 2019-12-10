"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Service = void 0;

var _sequelize = _interopRequireDefault(require("sequelize"));

var _sequelize2 = _interopRequireDefault(require("./sequelize"));

var _Bot = require("./Bot");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const Service = _sequelize2.default.define('service', {
  id: {
    // service ID
    type: _sequelize.default.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  name: {
    // service name
    type: _sequelize.default.STRING
  },
  botId: {
    // Glip bot ID
    type: _sequelize.default.STRING
  },
  groupId: {
    // Glip group ID
    type: _sequelize.default.STRING
  },
  userId: {
    // Glip user ID
    type: _sequelize.default.STRING
  },
  data: {
    // all other data associcated with this service
    type: _sequelize.default.JSON
  }
});

exports.Service = Service;

Service.prototype.check = async function () {
  const bot = await _Bot.Bot.findByPk(this.botId);

  if (!bot) {
    await this.destroy();
    return;
  }

  const group = await bot.getGroup(this.groupId);

  if (!group || group.members.indexOf(bot.id) === -1) {
    await this.destroy();
  }
};
//# sourceMappingURL=Service.js.map