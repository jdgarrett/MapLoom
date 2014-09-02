(function() {
  var module = angular.module('loom_cesium_directive', []);
  var cesiumVisible = true;

  module.directive('loomCesium',
      function() {
        return {
          replace: true,
          templateUrl: 'cesium/partials/cesium.tpl.html',
          link: function(scope, element) {
            scope.$on('toggle-3d', function() {
              cesiumVisible = !cesiumVisible;
              if (cesiumVisible) {
                element.css('display', 'block');
              } else {
                element.css('display', 'none');
              }
            });
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
              viewer = new Cesium.Viewer('cesiumContainer', {
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
              var message = formatError(exception);
              console.error(message);
              if (!document.querySelector('.cesium-widget-errorPanel')) {
                window.alert(message);
              }
              return;
            }

            viewer.extend(Cesium.viewerDragDropMixin);
            viewer.extend(Cesium.viewerEntityMixin);
            if (endUserOptions.inspector) {
              viewer.extend(Cesium.viewerCesiumInspectorMixin);
            }

            var vrTheWorldProvider = new Cesium.VRTheWorldTerrainProvider({
              url: '//www.vr-theworld.com/vr-theworld/tiles1.0.0/73/',
              credit: 'Terrain data courtesy VT MÄK'
            });
            viewer.scene.terrainProvider = vrTheWorldProvider;

            /*for (var x = 0; x < 10; x++) {
             for (var y = 0; y < 10; y++) {
             var modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(
             Cesium.Cartesian3.fromDegrees(-75.62898254394531 + 0.1 * x, 40.02804946899414 + 0.1 * y, 5000.0));
             viewer.scene.primitives.add(Cesium.Model.fromGltf({
             url: '../SampleData/models/CesiumAir/Cesium_Air.gltf',
             modelMatrix: modelMatrix,
             scale: 200.0
             }));
             }
             }*/

            viewer.scene.globe.depthTestAgainstTerrain = true;

            var showLoadError = function(name, error) {
              var title = 'An error occurred while loading the file: ' + name;
              var message = 'An error occurred while loading the file:';
              viewer.cesiumWidget.showErrorPanel(title, message, error);
            };

            viewer.dropError.addEventListener(function(viewerArg, name, error) {
              showLoadError(name, error);
            });

            var scene = viewer.scene;
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
                viewer.dataSources.add(dataSource);

                loadPromise.then(function() {
                  var lookAt = endUserOptions.lookAt;
                  if (goog.isDefAndNotNull(lookAt)) {
                    var entity = dataSource.entities.getById(lookAt);
                    if (goog.isDefAndNotNull(entity)) {
                      viewer.trackedEntity = entity;
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
                viewer.animation.applyThemeChanges();
              } else {
                var error = 'Unknown theme: ' + theme;
                viewer.cesiumWidget.showErrorPanel(error, '');
              }
            }
          }
        };
      });
}());
