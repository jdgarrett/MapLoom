(function() {
  var module = angular.module('loom_cesium_service', []);

  var service_ = null;
  var mapService_ = null;

  module.provider('cesiumService', function() {

    this.viewer = null;
    this.visible = true;
    this.imageLayers = [];

    this.$get = function(mapService) {
      service_ = this;
      mapService_ = mapService;
      return this;
    };

    this.createViewer = function(cesiumElement) {
      if (goog.isDefAndNotNull(service_.viewer)) {
        return;
      }
      var endUserOptions = {};
      var queryString = window.location.search.substring(1);
      if (queryString !== '') {
        var params = queryString.split('&');
        for (var i = 0, len = params.length; i < len; ++i) {
          var param = params[i];
          var keyValuePair = param.split('=');
          if (keyValuePair.length > 1) {
            endUserOptions[keyValuePair[0]] = decodeURIComponent(keyValuePair[1].replace(/\+/g, ' '));
          }
        }
      }

      var imageryProvider;

      if (endUserOptions.tmsImageryUrl) {
        imageryProvider = new Cesium.TileMapServiceImageryProvider({
          url: endUserOptions.tmsImageryUrl
        });
      }

      try {
        service_.viewer = new Cesium.Viewer(cesiumElement, {
          imageryProvider: imageryProvider,
          baseLayerPicker: false,
          scene3DOnly: endUserOptions.scene3DOnly,
          fullscreenButton: false,
          geocoder: false,
          homeButton: false,
          infoBox: false,
          sceneModePicker: false,
          timeline: false,
          navigationHelpButton: false,
          navigationInstructionsInitiallyVisible: false,
          animation: false
        });
      } catch (exception) {
        var message = Cesium.formatError(exception);
        console.error(message);
        if (!document.querySelector('.cesium-widget-errorPanel')) {
          window.alert(message);
        }
        return;
      }

      service_.viewer.extend(Cesium.viewerDragDropMixin);
      service_.viewer.extend(Cesium.viewerEntityMixin);
      if (endUserOptions.inspector) {
        service_.viewer.extend(Cesium.viewerCesiumInspectorMixin);
      }

      var vrTheWorldProvider = new Cesium.VRTheWorldTerrainProvider({
        url: '//www.vr-theworld.com/vr-theworld/tiles1.0.0/73/',
        credit: 'Terrain data courtesy VT MÄK'
      });
      service_.viewer.scene.terrainProvider = vrTheWorldProvider;

      service_.viewer.scene.globe.depthTestAgainstTerrain = true;

      //remove the default bing imagery layer
      var bingLayer = service_.viewer.scene.imageryLayers.get(0);
      service_.viewer.scene.imageryLayers.remove(bingLayer, true);

      mapService_.map.getLayers().forEach(function(layer) {
        service_.addLayer(layer);
      });

      var showLoadError = function(name, error) {
        var title = 'An error occurred while loading the file: ' + name;
        var message = 'An error occurred while loading the file: ';
        service_.viewer.cesiumWidget.showErrorPanel(title, message, error);
      };

      service_.viewer.dropError.addEventListener(function(viewerArg, name, error) {
        showLoadError(name, error);
      });

      var scene = service_.viewer.scene;
      var context = scene.context;
      if (endUserOptions.debug) {
        context.validateShaderProgram = true;
        context.validateFramebuffer = true;
        context.logShaderCompilation = true;
        context.throwOnWebGLError = true;
      }

      var source = endUserOptions.source;
      if (goog.isDefAndNotNull(source)) {
        var dataSource;
        var loadPromise;

        if (/\.czml$/i.test(source)) {
          dataSource = new Cesium.CzmlDataSource(Cesium.getFilenameFromUri(source));
          loadPromise = dataSource.loadUrl(source);
        } else if (/\.geojson$/i.test(source) || /\.json$/i.test(source) || /\.topojson$/i.test(source)) {
          dataSource = new Cesium.GeoJsonDataSource(Cesium.getFilenameFromUri(source));
          loadPromise = dataSource.loadUrl(source);
        } else {
          showLoadError(source, 'Unknown format.');
        }

        if (goog.isDefAndNotNull(dataSource)) {
          service_.viewer.dataSources.add(dataSource);

          loadPromise.then(function() {
            var lookAt = endUserOptions.lookAt;
            if (goog.isDefAndNotNull(lookAt)) {
              var entity = dataSource.entities.getById(lookAt);
              if (goog.isDefAndNotNull(entity)) {
                service_.viewer.trackedEntity = entity;
              } else {
                var error = 'No entity with id "' + lookAt + '" exists in the provided data source.';
                showLoadError(source, error);
              }
            }
          }).otherwise(function(error) {
            showLoadError(source, error);
          });
        }
      }

      if (endUserOptions.stats) {
        scene.debugShowFramesPerSecond = true;
      }

      var theme = endUserOptions.theme;
      if (goog.isDefAndNotNull(theme)) {
        if (endUserOptions.theme === 'lighter') {
          document.body.classList.add('cesium-lighter');
          service_.viewer.animation.applyThemeChanges();
        } else {
          var error = 'Unknown theme: ' + theme;
          service_.viewer.cesiumWidget.showErrorPanel(error, '');
        }
      }
    };

    this.toggleVisibility = function() {
      service_.visible = !service_.visible;
      if (!service_.visible) {
        // stop the render loop while the scene isn't visible
        service_.viewer.targetFrameRate = 0.0001;
      } else {
        // render at normal rate
        service_.viewer.targetFrameRate = undefined;
        var currentView = mapService_.map.getView().getView2D().calculateExtent([$(window).height(),
              $(window).width()]);
        var minBox = ol.proj.transform([currentView[0], currentView[1]],
            mapService_.map.getView().getView2D().getProjection(), 'EPSG:4326');
        var maxBox = ol.proj.transform([currentView[2], currentView[3]],
            mapService_.map.getView().getView2D().getProjection(), 'EPSG:4326');
        while (minBox[0] > maxBox[0]) {
          minBox[0] -= 360;
        }
        while (minBox[1] > maxBox[1]) {
          minBox[1] -= 180;
        }
        minBox[0] = minBox[0] + (maxBox[0] - minBox[0]) * 0.33333 * 0.65;
        maxBox[0] = maxBox[0] - (maxBox[0] - minBox[0]) * 0.33333 * 0.65;
        minBox[1] = minBox[1] + (maxBox[1] - minBox[1]) * 0.33333 * 0.65;
        maxBox[1] = maxBox[1] - (maxBox[1] - minBox[1]) * 0.33333 * 0.65;
        service_.viewer.scene.camera.flyToRectangle({
          destination: Cesium.Rectangle.fromDegrees(minBox[0], minBox[1], maxBox[0], maxBox[1]),
          duration: 0
        });
      }
    };

    this.addLayer = function(layer) {
      //need to add separate logic for non-WMS layers such as OSM
      var source = layer.getSource();
      console.log('layer source', source);
      var provider;
      if (source instanceof ol.source.OSM) {
        provider = new Cesium.OpenStreetMapImageryProvider();
      } else if (source instanceof ol.source.TileWMS) {
        provider = new Cesium.WebMapServiceImageryProvider({
          url: layer.get('metadata').url + '/wms',
          layers: layer.get('metadata').name,
          parameters: {transparent: 'true', format: 'image/png'}
        });
      } else if (source instanceof ol.source.BingMaps) {
        var style;
        switch (layer.get('metadata').name) {
          case 'Aerial':
            style = Cesium.BingMapsStyle.AERIAL;
            break;
          case 'AerialWithLabels':
            style = Cesium.BingMapsStyle.AERIAL_WITH_LABELS;
            break;
          case 'Road':
            style = Cesium.BingMapsStyle.ROAD;
            break;
          case 'CollinsBart':
            style = Cesium.BingMapsStyle.COLLINS_BART;
            break;
          case 'Survey':
            style = Cesium.BingMapsStyle.ORDNANCE_SURVEY;
            break;
        }
        provider = new Cesium.BingMapsImageryProvider({
          url: 'http://dev.virtualearth.net',
          mapStyle: style
        });
      }

      var imageLayer = service_.viewer.scene.imageryLayers.addImageryProvider(provider);

      var emptySpot = this.imageLayers.indexOf(null);
      if (emptySpot !== -1) {
        this.imageLayers[emptySpot] = {name: layer.get('metadata').name, layer: imageLayer};
      } else {
        this.imageLayers.push({name: layer.get('metadata').name, layer: imageLayer});
      }
    };

    //Helper function to get the Cesium image layer that corresponds to the passed in OL layer
    //returns an object containing the imageLayer and the index at which it occurs
    function getImageLayer(olLayer) {
      var layer = null;
      for (var i = 0; i < service_.imageLayers.length; ++i) {
        if (service_.imageLayers[i] !== null && service_.imageLayers[i].name == olLayer.get('metadata').name) {
          layer = service_.imageLayers[i].layer;
          break;
        }
      }

      return {index: i, layer: layer};
    }

    this.removeLayer = function(layer) {
      var imageLayer = getImageLayer(layer);

      service_.viewer.scene.imageryLayers.remove(imageLayer.layer, true);
      service_.imageLayers[imageLayer.index] = null;
    };

    this.reorderLayer = function(startIndex, endIndex) {
      var length = service_.viewer.scene.imageryLayers.length;
      var imageLayer = service_.viewer.scene.imageryLayers.get(length - (startIndex + 1));
      service_.viewer.scene.imageryLayers.remove(imageLayer, false);
      service_.viewer.scene.imageryLayers.add(imageLayer, length - (endIndex + 1));
    };

    this.toggleLayer = function(olLayer) {
      var imageLayer = getImageLayer(olLayer);

      imageLayer.layer.show = olLayer.get('visible');
    };
  });
}());

