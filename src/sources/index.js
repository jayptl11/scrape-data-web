const vietstock = require("./vietstock");

const sources = {
  [vietstock.id]: vietstock
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
