(function() {
  var module = angular.module('loom_cesium_directive', []);

  module.directive('loomCesium',
      function(cesiumService) {
        return {
          replace: true,
          templateUrl: 'cesium/partials/cesium.tpl.html',
          link: function(scope, element) {
            scope.$on('toggle-3d', function() {
              cesiumService.toggleVisibility();
              if (cesiumService.visible) {
                element.css('display', 'block');
              } else {
                element.css('display', 'none');
              }
            });

            scope.$on('layer-added', function(event, layer) {
              cesiumService.addLayer(layer);
            });

            scope.$on('layerRemoved', function(event, layer) {
              cesiumService.removeLayer(layer);
            });

            scope.$on('layer-reordered', function(event, startIndex, endIndex) {
              cesiumService.reorderLayer(startIndex, endIndex);
            });

            cesiumService.createViewer('cesiumContainer');
          }
        };
      });
}());
