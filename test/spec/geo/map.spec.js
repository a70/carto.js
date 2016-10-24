var _ = require('underscore');
var Backbone = require('backbone');
var VisModel = require('../../../src/vis/vis');
var PlainLayer = require('../../../src/geo/map/plain-layer');
var CartoDBLayer = require('../../../src/geo/map/cartodb-layer');
var TorqueLayer = require('../../../src/geo/map/torque-layer');
var TileLayer = require('../../../src/geo/map/tile-layer');
var WMSLayer = require('../../../src/geo/map/wms-layer');
var GMapsBaseLayer = require('../../../src/geo/map/gmaps-base-layer');
var LayersCollection = require('../../../src/geo/map/layers');
var LayersFactory = require('../../../src/vis/layers-factory');

var Point = require('../../../src/geo/geometry-models/point');
var Polyline = require('../../../src/geo/geometry-models/polyline');
var Polygon = require('../../../src/geo/geometry-models/polygon');

var fakeLayersFactory = new LayersFactory({
  visModel: new Backbone.Model(),
  windshaftSettings: {}
});

var Map = require('../../../src/geo/map');

describe('core/geo/map', function () {
  var map;

  beforeEach(function () {
    this.vis = new VisModel();

    this.map = map = new Map(null, { layersFactory: fakeLayersFactory });
  });

  describe('.initialize', function () {
    it('should parse bounds and set attributes', function () {
      var map = new Map({
        bounds: [[0, 1], [2, 3]]
      }, {
        layersFactory: fakeLayersFactory
      });

      expect(map.get('view_bounds_sw')).toEqual([0, 1]);
      expect(map.get('view_bounds_ne')).toEqual([2, 3]);
      expect(map.get('original_view_bounds_sw')).toEqual([0, 1]);
      expect(map.get('original_view_bounds_ne')).toEqual([2, 3]);
      expect(map.get('bounds')).toBeUndefined();
    });

    it('should set the center and zoom if no bounds are given', function () {
      var map = new Map({
        center: [41.40282319070747, 2.3435211181640625],
        zoom: 10
      }, {
        layersFactory: fakeLayersFactory
      });

      expect(map.get('center')).toEqual([41.40282319070747, 2.3435211181640625]);
      expect(map.get('original_center')).toEqual([41.40282319070747, 2.3435211181640625]);
      expect(map.get('zoom')).toEqual(10);
    });

    it('should set the default center and zoom if no center and bounds are given', function () {
      var map = new Map(null, {
        layersFactory: fakeLayersFactory
      });

      expect(map.get('center')).toEqual(map.defaults.center);
      expect(map.get('original_center')).toEqual(map.defaults.center);
      expect(map.get('zoom')).toEqual(map.defaults.zoom);
    });

    it('should parse the center when given a string', function () {
      var map = new Map({
        center: '[41.40282319070747, 2.3435211181640625]'
      }, { layersFactory: fakeLayersFactory });

      expect(map.get('center')).toEqual([41.40282319070747, 2.3435211181640625]);
    });
  });

  it('should raise only one change event on setBounds', function () {
    var c = 0;
    map.bind('change:view_bounds_ne', function () {
      c++;
    });
    map.setBounds([[1, 2], [1, 2]]);
    expect(c).toEqual(1);
  });

  it('should not change center or zoom when the bounds are not ok', function () {
    var c = 0;
    map.bind('change:center', function () {
      c++;
    });
    map.setBounds([[1, 2], [1, 2]]);
    expect(c).toEqual(0);
  });

  it('should not change bounds when map size is 0', function () {
    map.set('zoom', 10);
    var bounds = [[43.100982876188546, 35.419921875], [60.23981116999893, 69.345703125]];
    map.fitBounds(bounds, {x: 0, y: 0});
    expect(map.get('zoom')).toEqual(10);
  });

  it('should adjust zoom to layer', function () {
    expect(map.get('maxZoom')).toEqual(map.defaults.maxZoom);
    expect(map.get('minZoom')).toEqual(map.defaults.minZoom);

    var layer = new PlainLayer({ minZoom: 5, maxZoom: 25 });
    map.layers.reset(layer);

    expect(map.get('maxZoom')).toEqual(25);
    expect(map.get('minZoom')).toEqual(5);

    layer = new PlainLayer({ minZoom: '7', maxZoom: '31' });
    map.layers.reset(layer);

    expect(map.get('maxZoom')).toEqual(31);
    expect(map.get('minZoom')).toEqual(7);
  });

  it("shouldn't set a NaN zoom", function () {
    var layer = new PlainLayer({ minZoom: NaN, maxZoom: NaN });
    map.layers.reset(layer);

    expect(map.get('maxZoom')).toEqual(map.defaults.maxZoom);
    expect(map.get('minZoom')).toEqual(map.defaults.minZoom);
  });

  it('should update the attributions of the map when layers are reset/added/removed', function () {
    map = new Map(null, { layersFactory: fakeLayersFactory });

    // Map has the default CartoDB attribution
    expect(map.get('attribution')).toEqual([
      '© <a href="https://carto.com/attributions" target="_blank">CARTO</a>'
    ]);

    var layer1 = new CartoDBLayer({ attribution: 'attribution1' }, { vis: this.vis });
    var layer2 = new CartoDBLayer({ attribution: 'attribution1' }, { vis: this.vis });
    var layer3 = new CartoDBLayer({ attribution: 'wadus' }, { vis: this.vis });
    var layer4 = new CartoDBLayer({ attribution: '' }, { vis: this.vis });

    map.layers.reset([ layer1, layer2, layer3, layer4 ]);

    // Attributions have been updated removing duplicated and empty attributions
    expect(map.get('attribution')).toEqual([
      'attribution1',
      'wadus',
      '© <a href="https://carto.com/attributions" target="_blank">CARTO</a>'
    ]);

    var layer = new CartoDBLayer({ attribution: 'attribution2' }, { vis: this.vis });

    map.layers.add(layer);

    // The attribution of the new layer has been appended before the default CartoDB attribution
    expect(map.get('attribution')).toEqual([
      'attribution1',
      'wadus',
      'attribution2',
      '© <a href="https://carto.com/attributions" target="_blank">CARTO</a>'
    ]);

    layer.set('attribution', 'new attribution');

    // The attribution of the layer has been updated in the map
    expect(map.get('attribution')).toEqual([
      'attribution1',
      'wadus',
      'new attribution',
      '© <a href="https://carto.com/attributions" target="_blank">CARTO</a>'
    ]);

    map.layers.remove(layer);

    expect(map.get('attribution')).toEqual([
      'attribution1',
      'wadus',
      '© <a href="https://carto.com/attributions" target="_blank">CARTO</a>'
    ]);

    // Addind a layer with the default attribution
    layer = new CartoDBLayer({}, { vis: this.vis });

    map.layers.add(layer, { at: 0 });

    // Default CartoDB only appears once and it's the last one
    expect(map.get('attribution')).toEqual([
      'attribution1',
      'wadus',
      '© <a href="https://carto.com/attributions" target="_blank">CARTO</a>'
    ]);
  });

  describe('Layer creation methods', function () {
    var testCases = [
      {
        createMethod: 'createCartoDBLayer',
        expectedLayerModelClass: CartoDBLayer,
        expectedLayerModelType: 'CartoDB',
        testAttributes: {
          sql: 'something',
          cartocss: 'else'
        },
        expectedErrorMessage: 'The following attributes are missing: sql|source,cartocss'
      },
      { // CartoDB layer that points to a source (instead of having sql)
        createMethod: 'createCartoDBLayer',
        expectedLayerModelClass: CartoDBLayer,
        expectedLayerModelType: 'CartoDB',
        testAttributes: {
          source: 'a0',
          cartocss: 'else'
        },
        expectedErrorMessage: 'The following attributes are missing: sql|source,cartocss'
      },
      {
        createMethod: 'createTorqueLayer',
        expectedLayerModelClass: TorqueLayer,
        expectedLayerModelType: 'torque',
        testAttributes: {
          sql: 'something',
          cartocss: 'else'
        },
        expectedErrorMessage: 'The following attributes are missing: sql|source,cartocss'
      },
      { // Torque layer that points to a source (instead of having sql)
        createMethod: 'createTorqueLayer',
        expectedLayerModelClass: TorqueLayer,
        expectedLayerModelType: 'torque',
        testAttributes: {
          source: 'a0',
          cartocss: 'else'
        },
        expectedErrorMessage: 'The following attributes are missing: sql|source,cartocss'
      },
      {
        createMethod: 'createTileLayer',
        expectedLayerModelClass: TileLayer,
        expectedLayerModelType: 'Tiled',
        testAttributes: {
          urlTemplate: 'http://example.com'
        },
        expectedErrorMessage: 'The following attributes are missing: urlTemplate'
      },
      {
        createMethod: 'createWMSLayer',
        expectedLayerModelClass: WMSLayer,
        expectedLayerModelType: 'WMS',
        testAttributes: {
          urlTemplate: 'http://example.com'
        },
        expectedErrorMessage: 'The following attributes are missing: urlTemplate'
      },
      {
        createMethod: 'createGMapsBaseLayer',
        expectedLayerModelClass: GMapsBaseLayer,
        expectedLayerModelType: 'GMapsBase',
        testAttributes: {
          base_type: 'http://example.com'
        },
        expectedErrorMessage: 'The following attributes are missing: base_type'
      },
      {
        createMethod: 'createPlainLayer',
        expectedLayerModelClass: PlainLayer,
        expectedLayerModelType: 'Plain',
        testAttributes: {
          color: '#FABADA'
        },
        expectedErrorMessage: 'The following attributes are missing: image|color'
      },
      {
        createMethod: 'createPlainLayer',
        expectedLayerModelClass: PlainLayer,
        expectedLayerModelType: 'Plain',
        testAttributes: {
          image: 'http://example.com/image.png'
        },
        expectedErrorMessage: 'The following attributes are missing: image|color'
      }
    ];

    _.each(testCases, function (testCase) {
      describe('.' + testCase.createMethod, function () {
        it('should throw an error if no properties are given', function () {
          expect(function () {
            this.map[testCase.createMethod]({});
          }.bind(this)).toThrowError(testCase.expectedErrorMessage);
        });

        it('should return a layer of the corresponding type', function () {
          var layer = this.map[testCase.createMethod](testCase.testAttributes);
          expect(layer instanceof testCase.expectedLayerModelClass).toBeTruthy();
        });

        it('should be visible', function () {
          var layer = this.map[testCase.createMethod](testCase.testAttributes);
          expect(layer.get('visible')).toBeTruthy();
        });

        it('should set the right type', function () {
          var layer = this.map[testCase.createMethod](testCase.testAttributes);
          expect(layer.get('type')).toEqual(testCase.expectedLayerModelType);
        });

        it('should add the layer model to the collection of layers', function () {
          var layer = this.map[testCase.createMethod](testCase.testAttributes);
          expect(this.map.layers.at(0)).toEqual(layer);
        });

        it('should add the layer model at the given position', function () {
          var layer1 = this.map[testCase.createMethod](testCase.testAttributes);

          var layer0 = this.map[testCase.createMethod](testCase.testAttributes, { at: 0 });
          var layer2 = this.map[testCase.createMethod](testCase.testAttributes, { at: 2 });

          expect(this.map.layers.at(0)).toEqual(layer0);
          expect(this.map.layers.at(1)).toEqual(layer1);
          expect(this.map.layers.at(2)).toEqual(layer2);
        });
      });
    }, this);
  });

  describe('.reCenter', function () {
    it('should set the original bounds if present', function () {
      var map = new Map({
        bounds: [[1, 2], [3, 4]],
        center: '[41.40282319070747, 2.3435211181640625]'
      }, { layersFactory: fakeLayersFactory });

      // Change internal attributes
      map.set({
        view_bounds_sw: 'something',
        view_bounds_ne: 'else',
        center: 'different'
      });

      map.reCenter();

      expect(map.get('view_bounds_sw')).toEqual([1, 2]);
      expect(map.get('view_bounds_ne')).toEqual([3, 4]);
    });

    it('should set the original center if bounds are not present', function () {
      var map = new Map({
        center: [41.40282319070747, 2.3435211181640625]
      }, { layersFactory: fakeLayersFactory });

      map.set({
        center: 'different'
      });

      map.reCenter();

      expect(map.get('center')).toEqual([ 41.40282319070747, 2.3435211181640625 ]);
    });
  });

  describe('.getLayerById', function () {
    beforeEach(function () {
      var layer1 = new CartoDBLayer({ id: 'xyz-123', attribution: 'attribution1' }, { vis: this.vis });

      map.layers.reset(layer1);
    });

    it('should return the corresponding model for given id', function () {
      expect(map.getLayerById('xyz-123')).toBeDefined();
      expect(map.getLayerById('meh')).toBeUndefined();
    });
  });

  describe('.isInteractive', function () {
    beforeEach(function () {
      this.layer1 = new CartoDBLayer(null, { vis: new Backbone.Model() });
      this.layer2 = new CartoDBLayer(null, { vis: new Backbone.Model() });
      spyOn(this.layer1, 'hasInteraction').and.returnValue(false);
      spyOn(this.layer2, 'hasInteraction').and.returnValue(false);
      this.layersCollection = new LayersCollection([ this.layer1, this.layer2 ]);
      this.map = new Map(null, {
        layersCollection: this.layersCollection,
        layersFactory: fakeLayersFactory
      });
    });

    it('should be false', function () {
      expect(this.map.isInteractive()).toBeFalsy();
    });

    it('should be true if feature interactivity is enabled', function () {
      this.map.enableFeatureInteractivity();

      expect(this.map.isInteractive()).toBeTruthy();
    });

    describe('if feature interactivity is disabled', function () {
      beforeEach(function () {
        this.map.disableFeatureInteractivity();
        this.layer1.hasInteraction.and.returnValue(true);
        this.layer2.hasInteraction.and.returnValue(true);
        this.map.enablePopups();
      });

      it('should be true if popups are enabled', function () {
        expect(this.map.isInteractive()).toBeTruthy();
      });

      it('should be false if popups are disabled', function () {
        this.map.disablePopups();
        expect(this.map.isInteractive()).toBeFalsy();
      });

      it('should be false if none of the CartoDB layers have interaction', function () {
        this.layer1.hasInteraction.and.returnValue(false);
        this.layer2.hasInteraction.and.returnValue(false);
        expect(this.map.isInteractive()).toBeFalsy();
      });
    });
  });

  describe('.disableInteractivity', function () {
    it('should disable feature interactivity and popups', function () {
      this.map.enablePopups();
      this.map.enableFeatureInteractivity();

      this.map.disableInteractivity();

      expect(this.map.arePopupsEnabled()).toBeFalsy();
      expect(this.map.isFeatureInteractivityEnabled()).toBeFalsy();
    });
  });

  describe('.enableInteractivity', function () {
    it('should enable feature interactivity and popups', function () {
      this.map.disablePopups();
      this.map.disableFeatureInteractivity();

      this.map.enableInteractivity();

      expect(this.map.arePopupsEnabled()).toBeTruthy();
      expect(this.map.isFeatureInteractivityEnabled()).toBeTruthy();
    });
  });

  describe('geometry management', function () {
    _.each({
      drawPoint: Point,
      drawPolyline: Polyline,
      drawPolygon: Polygon
    }, function (ExpectedGeometryClass, methodUnderTest) {
      it('.' + methodUnderTest + ' should trigger an event with the right geometry', function () {
        var callback = jasmine.createSpy('callback');
        this.map.on('enterDrawingMode', callback);

        var geometry = this.map[methodUnderTest]();

        expect(geometry instanceof ExpectedGeometryClass).toBeTruthy();
        expect(callback).toHaveBeenCalledWith(geometry);
      });
    });

    it('.stopDrawingGeometry should trigger an event', function () {
      var callback = jasmine.createSpy('callback');
      this.map.on('exitDrawingMode', callback);

      this.map.stopDrawingGeometry();

      expect(callback).toHaveBeenCalled();
    });

    it('.editGeometry should trigger and event with the right geometry', function () {
      var callback = jasmine.createSpy('callback');
      this.map.on('enterEditMode', callback);

      var geometry = this.map.editGeometry({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: [
            -3.779296875,
            40.245991504199026
          ]
        }
      });

      expect(geometry instanceof Point).toBeTruthy();
      expect(callback).toHaveBeenCalledWith(geometry);
    });

    it('.stopEditingGeometry should trigger an event', function () {
      var callback = jasmine.createSpy('callback');
      this.map.on('exitEditMode', callback);

      this.map.stopEditingGeometry();

      expect(callback).toHaveBeenCalled();
    });
  });
});
