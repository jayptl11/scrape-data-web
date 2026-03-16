const vietstock = require("./vietstock");
const cafef = require("./cafef");

const sources = {
  [vietstock.id]: vietstock,
  [cafef.id]: cafef
};

function getSourceOptions() {
  return Object.values(sources).map((source) => ({
    id: source.id,
    label: source.label,
    description: source.description
  }));
}

module.exports = {
  sources,
  getSourceOptions
};
