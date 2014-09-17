var WFSHandler = function(_layer, _viewer, _geomName, _hasHeight, _hasLevels, _maxTiles) {
  this.layer = _layer;
  this.viewer = _viewer;
  this.geomName = _geomName;
  this.hasHeight = _hasHeight;
  this.hasLevels = _hasLevels;
  this.maxTiles = _maxTiles;
  this.tileQueue = [];
  this.queueRunning = false;
  this.cachedDataSources = {};

  this.onLoad = function(x, y, level, bbox) {
    var handler = this;
    if (!goog.isDefAndNotNull(handler.layer)) {
      return;
    }
    var doWork = function() {
      if (handler.tileQueue.length === 0) {
        handler.queueRunning = false;
        return;
      }
      var tile = handler.tileQueue.shift();
      var baseURL = handler.layer.get('metadata').url;
      var pathArray = baseURL.split('/');
      baseURL = pathArray[0] + '//' + pathArray[2];
      var buildingsURL = baseURL +
          '/WFSCache/WFSCacher?tilex=' + tile.x + '&tiley=' + tile.y + '&typeName=' +
          handler.layer.get('metadata').name + '&bbox=' + tile.bbox.west + ',' +
          tile.bbox.south + ',' + tile.bbox.east + ',' + tile.bbox.north +
          '&srsName=EPSG:4326&propertyName=' + handler.geomName + (handler.hasHeight ? ',height' : '') +
          (handler.hasLevels ? ',levels' : '') + '&outputFormat=application/json';

      var dataSource = new Cesium.GeoJsonDataSource(handler.layer.get('metadata').name, true);

      dataSource.loadUrl(buildingsURL).then(function() {
        if (dataSource.entities.entities.length > 0) {
          if (handler.viewer.dataSources.length >= handler.maxTiles) {
            // evict furthest tile
            var cameraPos = handler.viewer.scene.camera.position;
            var highest = 0;
            var xtile = -1;
            var ytile = -1;
            for (var xprop in handler.cachedDataSources) {
              if (handler.cachedDataSources.hasOwnProperty(xprop)) {
                for (var yprop in handler.cachedDataSources[xprop]) {
                  if (handler.cachedDataSources[xprop].hasOwnProperty(yprop) &&
                      goog.isDefAndNotNull(handler.cachedDataSources[xprop][yprop]) &&
                      goog.isDefAndNotNull(handler.cachedDataSources[xprop][yprop].position)) {
                    var distance =
                        Cesium.Cartesian3.distance(handler.cachedDataSources[xprop][yprop].position, cameraPos);
                    if (distance > highest) {
                      highest = distance;
                      xtile = xprop;
                      ytile = yprop;
                    }
                  }
                }
              }
            }
            if (xtile > -1) {
              var removed = handler.viewer.dataSources.remove(handler.cachedDataSources[xtile][ytile].dataSource);
              console.log('Removed: ', removed, ' dataSource at ', xtile, ytile);
              handler.cachedDataSources[xtile][ytile] = null;
            }
          }
          if (handler.cachedDataSources[tile.x][tile.y] === null) {
            setTimeout(doWork, 10);
            return;
          }
          handler.cachedDataSources[tile.x][tile.y].dataSource = dataSource;
          dataSource.entities.entities[0].polygon.material.color.setValue(Cesium.Color.LIGHTGRAY);
          dataSource.entities.entities[0].polygon.outline.setValue(false);
          //var positions = [];
          // Set heights
          for (var idx = 0; idx < dataSource.entities.entities.length; idx++) {
            var entity = dataSource.entities.entities[idx];
            if (entity.properties.height !== null && entity.properties.height !== undefined) {
              entity.polygon.extrudedHeight = new Cesium.ConstantProperty(entity.properties.height);
            } else if (entity.properties.levels !== null && entity.properties.levels !== undefined) {
              entity.polygon.extrudedHeight =
                  new Cesium.ConstantProperty(parseFloat(entity.properties.levels.replace(/\D/g, '')) * 3);
            } else {
              entity.polygon.extrudedHeight = new Cesium.ConstantProperty(3);
            }
            entity.polygon.height = new Cesium.ConstantProperty(0);
            //positions.push(entity.polygon.positions.getValue()[0]);
          }
          /*var cartographicPositions = Cesium.Ellipsoid.WGS84.cartesianArrayToCartographicArray(positions);
           console.log('positions:', cartographicPositions);
           var promise = Cesium.sampleTerrain(vrTheWorldProvider, 11, cartographicPositions);
           Cesium.when(promise, function(updatedPositions) {
           console.log('Updated positions:', updatedPositions);
           for (idx = 0; idx < dataSource.entities.entities.length; idx++) {
           var entity = dataSource.entities.entities[idx];
           var modifiedHeight = updatedPositions[idx].height;
           if (entity.properties.height !== null && entity.properties.height !== undefined) {
           entity.polygon.extrudedHeight =
           new Cesium.ConstantProperty(modifiedHeight + parseFloat(entity.properties.height));
           } else if (entity.properties.levels !== null && entity.properties.levels !== undefined) {
           entity.polygon.extrudedHeight = new Cesium.ConstantProperty(modifiedHeight +
           parseFloat(entity.properties.levels.replace(/\D/g, '')) * 3);
           } else {
           entity.polygon.extrudedHeight = new ConstantProperty(modifiedHeight);
           }
           entity.polygon.height = new ConstantProperty(modifiedHeight);
           }
           });*/
          handler.viewer.dataSources.add(dataSource);
          setTimeout(doWork, 10);
        } else {
          setTimeout(doWork, 0);
        }
      }, function(error) {
        //console.log('failed: ', error);
        setTimeout(doWork, 0);
      });
    };
    if (level === 15) {
      if (!goog.isDefAndNotNull(handler.cachedDataSources[x])) {
        handler.cachedDataSources[x] = {};
      }
      if (!goog.isDefAndNotNull(handler.cachedDataSources[x][y])) {
        handler.cachedDataSources[x][y] = {};
        var bboxCentroid = new Cesium.Cartographic(Cesium.Math.toRadians(bbox.west),
            Cesium.Math.toRadians(bbox.south), 0.0);
        handler.cachedDataSources[x][y].position = Cesium.Ellipsoid.WGS84.cartographicToCartesian(bboxCentroid);
        handler.tileQueue.push({x: x, y: y, bbox: bbox});
        //doWork();
        if (!handler.queueRunning) {
          handler.queueRunning = true;
          setTimeout(doWork, 10);
        }
      }
    }
  };
};
