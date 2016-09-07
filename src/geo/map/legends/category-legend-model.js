var LegendModelBase = require('./legend-model-base');

var CategoryLegendModel = LegendModelBase.extend({
  defaults: {
    visible: false,
    type: 'category',
    prefix: '',
    sufix: ''
  },

  isAvailable: function () {
    return !!this.get('categories');
  }
});

module.exports = CategoryLegendModel;
