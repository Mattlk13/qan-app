(function(){
    'use strict';

    var ppl = angular.module('ppl', [
        'ngResource',
        'ngSanitize',
        'ngCookies',
        'ui.router',
        'ui.bootstrap',
        'ui.bootstrap.datetimepicker',
        'chart.js',
        'hljs',
        'angularBootstrapNavTree',
        'angularMoment',
        'ngclipboard',
        'ngNumeraljs',
        'pplControllers',
        'pplServices',
        'pplDirectives',
        'pplFilters'
    ]).config(configure)
      .constant('constants', {
          // URI of datastore API
          API_PATH: window.location.protocol + '//'+ window.location.hostname + ':9001',
          DEFAULT_ERR: 'QAN API error. <br />Check the /var/log/qan-api.log file in docker container for more information.',
          API_ERR: 'QAN API error: "<err_msg>".<br />Check the /var/log/qan-api.log file in docker container for more information.',
          AGENT_ERR: 'Agent API error: "<err_msg>".<br />Check the agent log file for more information.',
          CONFIRM_STOP_AGENT: 'Are you sure you want to stop the agent?\nPlease note: you cannot start it again from UI.',
          DTM_FORMAT: 'YYYY-MM-DDTHH:mm:ss',
          DEMO: false
      })
      .constant('angularMomentConfig', {
              timezone: 'UTC'
      });


    configure.$inject = ['$stateProvider', '$httpProvider', '$urlRouterProvider', '$resourceProvider', '$tooltipProvider'];

    function configure($stateProvider, $httpProvider, $urlRouterProvider, $resourceProvider, $tooltipProvider) {

        $tooltipProvider.setTriggers({
            'mouseenter': 'mouseleave',
            'click': 'click',
            'focus': 'blur'
        });

        function setVersionedUrl(url) {
            // catch /ng/views/ HTML templates only
            if (!url || url.indexOf('/client/') < 0) return url;
            var param = 'v=' + STATIC_VERSION;
            return url + '?' + param;
        }

        $httpProvider.interceptors.push(function($rootScope, $q, constants, $timeout) {
            $rootScope.alerts = [];
            $rootScope.loading = false;
            $rootScope.closeAlert = function(index) {
                $rootScope.alerts.splice(index, 1);
            };
            return {
                request: function (config) {
                    $rootScope.loading = true;
                    config.timeout = 20000;
                    // Intercept Angular external request to static files
                    // to append version number to defeat the cache problem.
                    config.url = setVersionedUrl(config.url);
                    config.useLegacyPromise = false;
                    return config;
                },
                requestError: function(rejection) {
                    $rootScope.loading = false;
                    // do something on error
                    return $q.reject(rejection);
                },
                response: function(response) {
                    $rootScope.loading = false;
                    if ($rootScope.alerts.length) {
                        $timeout(function () {
                            $rootScope.alerts = [];
                        }, 5000);
                    }
                    return response;
                },
                responseError: function (rejection) {
                    $rootScope.loading = false;
                    $rootScope.alerts.pop();
                    $rootScope.connection_error = false;
                    if (rejection.status === -1) {
                        $rootScope.alerts.push({
                            msg: 'Cannot connect to the QAN API.',
                            type: 'danger'
                        });
                        $rootScope.connection_error = true;
                    }
                    return $q.reject(rejection);
                }
            };
        });


        $stateProvider.state('root', {
            url: '/',
            templateUrl: 'client/templates/query_profile_grid.html',
            controller: 'QueryProfileController',
            resolve: {
                instance: function (Instance, $rootScope, constants) {
                    $rootScope.showFullMenu = true;
                    return Instance.query()
                          .$promise
                          .then(function(resp) {
                              var instances = [];
                              for (var i=0; i < resp.length; i++) {
                                  if (resp[i].Subsystem === 'os' || resp[i].Subsystem === 'agent') {
                                      continue;
                                  }
                                  instances.push(resp[i]);
                              }
                              if (instances.length === 0) {
                                  $rootScope.alerts.push({
                                      msg: 'There are no instances.',
                                      type: 'danger'
                                  });
                                  $rootScope.connection_error = true;
                              }

                              $rootScope.instance = instances[0];
                              return {
                                  instances: instances,
                                  selected_instance: instances[0]
                              };
                          })
                          .catch(function(resp, err){
                              $rootScope.alerts.push({
                                  msg: constants.DEFAULT_ERR,
                                  type: 'danger'
                              });
                              $rootScope.connection_error = true;
                          })
                          .finally(function(resp){});
                }
            }
        })
        .state('root.instance-dt', {
            url: 'instance/:uuid/begin/:begin/end/:end/',
        })
        .state('root.instance-dt.query', {
            url: 'query/:query_id/'
        })
        .state('root.instance-dt.summary', {
            url: 'summary/'
        })
        .state('management', {
            url: '/management/:subsystem/:uuid',
            templateUrl: 'client/templates/management.html',
            controller: 'ManagementController',
            resolve: {
                instances: function (Instance, $rootScope) {
                    $rootScope.showFullMenu = false;
                    return Instance.query()
                          .$promise
                          .then(function(resp) {
                              var instancesByUUID = {};
                              var len = resp.length;
                              for (var i=0; len > i; i++) {
                                  instancesByUUID[resp[i].UUID] = resp[i];
                              }
                              return {
                                  'asDict': instancesByUUID,
                                  'asArray': resp
                              };
                          })
                          .catch(function(resp, err){
                              $rootScope.alerts.push({
                                  msg: constants.DEFAULT_ERR,
                                  type: 'danger'
                              });
                              return {};
                          })
                          .finally(function(resp){});
                }
            }
        });

        $urlRouterProvider.rule(function ($injector, $location) {
            var path = $location.url();
            if (path === '') {
                return '/';
            }
            return path;
        });
    }

    ppl.run(['$rootScope', '$state', '$stateParams', '$http', 'constants', function($rootScope, $state, $stateParams, $http, constants) {
        $rootScope.$state = $state;
        $rootScope.$stateParams = $stateParams;

        $rootScope.showAlert = function(resp, text, msg, type) {
            var msg = msg || constants.API_ERR;
            if (text !== undefined) {
                msg = msg.replace('<err_msg>', text);
            } else {
                if (resp.hasOwnProperty('data') && resp.data !== null && resp.data.hasOwnProperty('Error')) {
                    msg = msg.replace('<err_msg>', resp.data.Error);
                }
            }
            $rootScope.alerts.push({
                'type': type || 'danger',
                'msg': msg
            });
        };
    }]);

})();
