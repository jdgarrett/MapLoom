(function() {
  var module = angular.module('loom_feature_blame_service', []);

  // Private Variables
  var rootScope_ = null;
  var geogitService_ = null;
  var q_ = null;

  module.provider('featureBlameService', function() {

    this.$get = function($rootScope, $q, geogitService) {
      rootScope_ = $rootScope;
      geogitService_ = geogitService;
      q_ = $q;

      return this;
    };

    this.performBlame = function(repoId, options) {
      var deferredResponse = q_.defer();
      geogitService_.command(repoId, 'blame', options).then(function(response) {
        if (goog.isDefAndNotNull(response.Blame) && goog.isDefAndNotNull(response.Blame.Attribute)) {
          rootScope_.$broadcast('blame-performed');
          deferredResponse.resolve(response.Blame.Attribute);
        } else {
          deferredResponse.reject();
        }
      }, function(reject) {
        //failed to get diff
        deferredResponse.reject(reject);
      });
      return deferredResponse.promise;
    };
  });
}());
