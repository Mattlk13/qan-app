(function(){
    'use strict';

    function utf8_to_b64(str) {
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(match, p1) {
            return String.fromCharCode('0x' + p1);
        }))
    }

    function b64_to_utf8(str) {
        return decodeURIComponent(unescape(window.atob(str)));
    }

    var pplControllers = angular.module('pplControllers', []);

    pplControllers.controller('QueryProfileController', [
            '$scope',
            '$rootScope',
            '$filter',
            '$state',
            'constants',
            'QueryProfile',
            'Metric',
            'Agent',
            'Instance',
            'Config',
            '$modal',
            'instance',
            function($scope, $rootScope, $filter, $state, constants, QueryProfile,
                Metric, Agent, Instance, Config, $modal, instance) {

                $scope.init = function() {
                    $scope.qanData = [];
                    $scope.offset = 0;
                    $scope.loadedToTableQueries = 0;
                    $rootScope.DEMO = constants.DEMO
                        if ($rootScope.alerts.length === 0) {
                            $scope.instance_uuid = instance.selected_instance.UUID;
                            $rootScope.instance_DSN = instance.selected_instance.DSN.replace(/:.+@/, ':***@');

                            $rootScope.instances = instance.instances;
                            $rootScope.instance = instance.selected_instance;

                            $scope.getConfig();

                            $scope.query = '';
                            // it is need to disable future dates.
                            $rootScope.dtCal = null;
                            $scope.queryExplain = '';

                            $rootScope.time_range = '1h';
                            $rootScope.$watch('time_range', function(time_range, old_time_range) {
                                //$scope.setTimeRange(time_range);
                                if (time_range === 'cal') {
                                    $scope.old_time_range = old_time_range;
                                } else {
                                    $scope.setTimeRange(time_range);
                                }
                            });
                        }

                };

                $rootScope.goToQueries = function(instance) {
                    $rootScope.search = '';
                    $state.go('root.instance-dt', {
                        uuid: $rootScope.instance.UUID,
                    }, { reload: true });
                };

                $rootScope.changeInstance = function(instance) {
                    $rootScope.instance = instance;
                    $state.go('root.instance-dt', {
                        uuid: $rootScope.instance.UUID,
                    });
                    $scope.metrics = null;
                    $rootScope.metrics = null;
                    $scope.getConfig();
                    $scope.qanData = [];
                    $scope.offset = 0;
                    $scope.loadedToTableQueries = 0;

                    $scope.queryExplain = '';
                    $scope.query = '';
                    $rootScope.query = null;
                    $rootScope.isServerSummary = false;

                    $scope.getProfile();
                };

                $scope.getConfig = function () {
                    Config.query({instance_uuid: $rootScope.instance.UUID})
                        .$promise
                        .then(function(resp) {
                            $rootScope.config = resp;
                        })
                    .catch(function(resp) {
                        var msg = constants.DEFAULT_ERR;
                        if (resp.status === 404) {
                            msg = constants.API_ERR;
                            msg = msg.replace('<err_msg>', 'MySQL Query Analytics configuration not found');
                        } else {
                            if (resp.hasOwnProperty('data') && resp.data.hasOwnProperty('Error')) {
                                msg = constants.API_ERR;
                                msg = msg.replace('<err_msg>', resp.data.Error);
                            }
                        }
                        $rootScope.alerts.push({
                            'type': 'danger',
                            'msg': msg
                        });
                    })
                    .finally(function(resp){});
                };



                var checkActive = function($view, min_date, max_date, date_i) {
                    var isBetween = date_i.isBetween(min_date, max_date);
                    var isSameMin = date_i.isSame(min_date, $view);
                    var isSameMax = date_i.isSame(max_date, $view);
                    if (isBetween || isSameMin || isSameMax) {
                        return true;
                    }
                    return false;
                };

                $rootScope.beforeRender = function($view, $dates, $leftDate, $upDate, $rightDate) {
                    var now = moment();
                    for (var i=0; i<$dates.length; i++) {
                        if ($view === 'hour') {
                            $dates[i].display = moment.utc($dates[i].utcDateValue).format('HH:mm');
                        }
                        var date_i = moment.utc($dates[i].utcDateValue);
                        $dates[i].selectable = !date_i.isAfter(now, $view);
                        if ($scope.min_dt && $scope.max_dt) {
                            $dates[i].active = checkActive($view, $scope.min_dt, $scope.max_dt, date_i);
                        }
                    }
                };

                $rootScope.doSearch = function() {
                    $scope.metrics = null;
                    $rootScope.metrics = null;
                    $scope.qanData = [];
                    $scope.offset = 0;
                    $scope.loadedToTableQueries = 0;

                    $scope.queryExplain = '';
                    $scope.query = '';
                    $rootScope.query = null;
                    $rootScope.isServerSummary = false;
                    $scope.offset = 0;

                    $scope.getProfile();
                };

                $rootScope.doRefresh = function(time_range) {
                    $rootScope.exampleFormatted = '';
                    if (time_range === 'cal') {
                        $scope.metrics = null;
                        $rootScope.metrics = null;
                        $scope.qanData = [];
                        $scope.offset = 0;
                        $scope.loadedToTableQueries = 0;

                        $scope.queryExplain = '';
                        $scope.query = '';
                        $rootScope.query = null;
                        $rootScope.isServerSummary = false;
                        $scope.offset = 0;

                        $scope.getProfile();
                    } else {
                        $scope.setTimeRange(time_range);
                    }
                };

                $rootScope.onTimeSet = function(newDate, oldDate) {
                        $scope.metrics = null;
                        $rootScope.metrics = null;
                        $scope.query_id = '';

                    if ($scope.date1 === undefined) {
                        $scope.begin = undefined;
                        $scope.end = undefined;
                        $scope.min_dt = undefined;
                        $scope.max_dt = undefined;
                        $scope.b = undefined;
                        $scope.e = undefined;
                        var date1 = $filter('date')(newDate, 'yyyy-MM-dd HH:mm:ss');
                        $scope.date1 = moment.utc(date1, 'YYYY-MM-DD HH:mm:ss');

                        $rootScope.dtRange = $scope.date1.format('YYYY-MM-DD HH:mm:ss') +
                            ' - Please select one more date';
                    } else {
                        var date2 = $filter('date')(newDate, 'yyyy-MM-dd HH:mm:ss');
                        $scope.date2 = moment.utc(date2, 'YYYY-MM-DD HH:mm:ss');
                    }

                    if ($scope.date1 !== undefined && $scope.date2 !== undefined) {
                        $scope.begin = moment.min($scope.date1, $scope.date2);
                        $scope.end = moment.max($scope.date1, $scope.date2);

                        $scope.min_dt = $scope.begin.clone();
                        $scope.max_dt = $scope.end.clone();
                        $scope.b = $scope.begin.clone();
                        $scope.e = $scope.end.clone();
                        $rootScope.dtDuration = moment.duration($scope.end.diff($scope.begin), 'ms').humanize();
                        $rootScope.begin = $scope.begin = $scope.begin.format('YYYY-MM-DDTHH:mm:ss');
                        $rootScope.end = $scope.end = $scope.end.format('YYYY-MM-DDTHH:mm:ss');
                        $rootScope.query = null;
                        $state.go('root.instance-dt', {
                            uuid: $rootScope.instance.UUID,
                            begin: $scope.begin,
                            end: $scope.end
                        });
                        $rootScope.dtRange = $scope.b.format('YYYY-MM-DD HH:mm:ss') +
                            ' to ' +
                            $scope.e.format('YYYY-MM-DD HH:mm:ss') +
                            ' UTC';
                        $rootScope.time_range = 'cal';
                        $scope.qanData = [];
                        $scope.offset = 0;
                        $scope.loadedToTableQueries = 0;

                        $scope.queryExplain = '';
                        $scope.query = '';
                        $rootScope.query = null;
                        $rootScope.isServerSummary = false;

                        $scope.getProfile();
                        $scope.date1 = undefined;
                        $scope.date2 = undefined;
                    }
                };

                $scope.setTimeRange = function(time_range) {
                    $scope.metrics = null;
                    $rootScope.metrics = null;
                    $rootScope.query = null;
                    $scope.query_id = '';

                    var begin = moment.utc();
                    var end = moment.utc();
                    $scope.min_dt = undefined;
                    $scope.max_dt = undefined;
                    $rootScope.$broadcast('resetCal');
                    switch (time_range) {
                        case '1h':
                            begin.subtract(1, 'hours');
                            break;
                        case '3h':
                            begin.subtract(3, 'hours');
                            break;
                        case '6h':
                            begin.subtract(6, 'hours');
                            break;
                        case '12h':
                            begin.subtract(12, 'hours');
                            break;
                        case '1d':
                            begin.subtract(1, 'days');
                            break;
                        case '5d':
                            begin.subtract(5, 'days');
                            break;
                        case 'cal':
                            break;
                        default:
                            begin.subtract(1, 'hours');
                    }
                    $rootScope.dtDuration = moment.duration(end.diff(begin), 'ms').humanize();

                    $rootScope.begin = $scope.begin = begin.format('YYYY-MM-DDTHH:mm:ss');
                    $rootScope.end = $scope.end = end.format('YYYY-MM-DDTHH:mm:ss');
                    $rootScope.dtRange = begin.format('YYYY-MM-DD HH:mm:ss') +
                        ' to ' +
                        end.format('YYYY-MM-DD HH:mm:ss') +
                        ' UTC';

                    $state.go('root.instance-dt', {
                        uuid: $rootScope.instance.UUID,
                        begin: $scope.begin,
                        end: $scope.end
                    });
                    $scope.qanData = [];
                    $scope.offset = 0;
                    $scope.loadedToTableQueries = 0;

                    $scope.queryExplain = '';
                    $scope.query = '';
                    $rootScope.query = null;
                    $rootScope.isServerSummary = false;

                    $scope.getProfile();
                };

                $scope.qanSelectRow = function(row) {
                    if ($scope.query_id !== row.Id) {
                        $rootScope.row = row;
                        $rootScope.selectedQuery = row;
                        $scope.query_id = row.Id;
                        $scope.query_abstract = row.Abstract;
                        $rootScope.query_abstract = row.Abstract;

                        $state.go('root.instance-dt.query', {
                            query_id: row.Id
                        });

                    }
                };

                $scope.qanSelectSummary = function(row) {
                    $scope.query_id = null;
                    $scope.query_abstract = null;
                    $scope.server_summary = true;
                    $rootScope.query_abstract = null;
                    $rootScope.query = null;
                    $state.go('root.instance-dt.summary', {});
                };

                $scope.loadMore = function() {
                    $scope.offset += 10;
                    $scope.getProfile();
                };

                $scope.getProfile = function() {
                    var params = {
                        instance_uuid: $rootScope.instance.UUID,
                        begin: $scope.begin,
                        end: $scope.end,
                        offset: $scope.offset
                    };
                    if ($rootScope.search) {
                        params['search'] = utf8_to_b64($rootScope.search);
                    }
                    QueryProfile.query(params)
                        .$promise
                        .then(function(resp) {
                            if (resp.Query !== null) {
                                if ($scope.qanData === undefined) {
                                    $scope.qanData = [];
                                }
                                $rootScope.totalTime = resp.TotalTime;
                                $scope.totalQueries = resp.TotalQueries;

                                $rootScope.totalQueries = resp.TotalQueries;
                                $scope.profileTotal = resp.Query.shift();
                                $rootScope.profileTotal = $scope.profileTotal;
                                $scope.returnedQueries = resp.Query.length;

                                $scope.loadedToTableQueries += $scope.returnedQueries;
                                $scope.leftInDbQueries = $scope.totalQueries - $scope.loadedToTableQueries;

                                for (var i=0; i<$scope.returnedQueries; i++) {
                                    $scope.qanData.push(resp.Query[i]);
                                }
                            } else {
                                $scope.qanData = null;
                            }
                        })
                    .catch(function(resp) {
                        var msg = constants.DEFAULT_ERR;
                        if (resp.hasOwnProperty('data') && resp.data.hasOwnProperty('Error')) {
                            msg = constants.API_ERR;
                            msg = msg.replace('<err_msg>', resp.data.Error);
                        }
                        $scope.qanData = null;
                        $rootScope.alerts.push({
                            'type': 'danger',
                            'msg': msg
                        });
                    })
                    .finally(function(resp){});

                };

                $scope.init();
            }]);

    pplControllers.controller('MetricsController', [
            '$scope',
            '$rootScope',
            '$state',
            'constants',
            'Metric',
            'MetricSummary',
            function($scope, $rootScope, $state, constants, Metric, MetricSummary) {

                $scope.init = function () {

                    $rootScope.$on('$stateChangeSuccess',
                            function(event, toState, toParams, fromState, fromParams) {
                                $rootScope.isServerSummary = false;
                                $rootScope.isMetrics = false;

                                $scope.isServerSummary = false;
                                $scope.isMetrics = false;

                                $scope.query = null;
                                $rootScope.query = null;
                                $scope.example = null;
                                $rootScope.example = null;
                                $scope.queryExplain = '';

                                if ($state.is('root.instance-dt.query')) {
                                    $scope.metrics = null;
                                    $rootScope.metrics = null;

                                    $rootScope.isMetrics = true;
                                    $rootScope.isServerSummary = false;

                                    $scope.isServerSummary = false;
                                    $scope.isMetrics = true;

                                    $scope.getMetrics();
                                }
                                if ($state.is('root.instance-dt.summary')) {
                                    $scope.metrics = null;
                                    $rootScope.metrics = null;

                                    $rootScope.isServerSummary = true;
                                    $rootScope.isMetrics = false;

                                    $scope.isServerSummary = true;
                                    $scope.isMetrics = false;
                                    $scope.getSummary();
                                }
                            }
                    );
                };


                $scope.getSummary = function () {
                    var params = {
                        instance_uuid: $state.params.uuid,
                        begin: $state.params.begin,
                        end: $state.params.end
                    };
                    MetricSummary.query(params)
                        .$promise
                        .then(function(resp) {
                            $scope.duration = moment.duration(moment(resp.End).diff(moment(resp.Begin))).asSeconds();

                            $scope.metrics = resp.Metrics2;
                            $rootScope.metrics = resp.Metrics2;
                            $scope.sparks = resp.Sparks2;
                            $rootScope.sparks = resp.Sparks2;

                        })
                    .catch(function(resp) {
                        var msg = constants.DEFAULT_ERR;
                        if (resp.hasOwnProperty('data') && resp.data.hasOwnProperty('Error')) {
                            msg = constants.API_ERR;
                            msg = msg.replace('<err_msg>', resp.data.Error);
                        }
                        $rootScope.alerts.push({
                            'type': 'danger',
                            'msg': msg
                        });
                    })
                    .finally(function(resp){});
                };

                $scope.getMetrics = function () {
                    var params = {
                        instance_uuid: $state.params.uuid,
                        query_uuid: $state.params.query_id,
                        begin: $state.params.begin,
                        end: $state.params.end
                    };
                    Metric.query(params)
                        .$promise
                        .then(function(resp) {
                            $scope.query = resp.Query;
                            $rootScope.query = resp.Query;
                            $scope.example = resp.Example;
                            $rootScope.example = resp.Example;

                            $scope.metrics = resp.Metrics2;
                            $rootScope.metrics = resp.Metrics2;
                            $scope.sparks = resp.Sparks2;
                            $rootScope.sparks = resp.Sparks2;
                        })
                    .catch(function(resp) {
                        var msg = constants.DEFAULT_ERR;
                        if (resp.hasOwnProperty('data') && resp.data.hasOwnProperty('Error')) {
                            msg = constants.API_ERR;
                            msg = msg.replace('<err_msg>', resp.data.Error);
                        }
                        $rootScope.alerts.push({
                            'type': 'danger',
                            'msg': msg
                        });
                    })
                    .finally(function(resp){});
                };

                $scope.init();
            }]);

    pplControllers.controller('QueryController', [
            '$scope',
            '$rootScope',
            '$state',
            '$filter',
            'constants',
            function($scope, $rootScope, $state, $filter, constants) {
                $scope.init = function () {
                    $scope.toggleQuery = 'example';
                    $rootScope.$watch('query', function (newValue, oldValue) {
                        $rootScope.exampleFormatted = '';
                        if ($rootScope.query !== null) {
                            $scope.changeQuery();
                        }
                    });
                };

                $scope.changeQuery = function() {
                    $scope.firstSeen = moment.utc($rootScope.query.FirstSeen,
                            'YYYY-MM-DDTHH:mm:ssZ').format('LLLL [UTC]');
                    $scope.lastSeen = moment.utc($rootScope.query.LastSeen,
                            'YYYY-MM-DDTHH:mm:ssZ').format('LLLL [UTC]');
                    $scope.firstSeenAgo = moment.utc($rootScope.query.FirstSeen,
                            'YYYY-MM-DDTHH:mm:ssZ').fromNow();
                    $scope.lastSeenAgo = moment.utc($rootScope.query.LastSeen,
                            'YYYY-MM-DDTHH:mm:ssZ').fromNow();

                    $rootScope.exampleFormatted = $filter('sqlReformat')($rootScope.example.Query);
                    $scope.fingerprint = $filter('sqlReformat')($rootScope.query.Fingerprint);
                };

                $scope.init();
            }]);

    pplControllers.controller('QueryExplainController', [
            '$scope',
            '$rootScope',
            '$filter',
            'constants',
            'AgentCmd',
            function($scope, $rootScope, $filter, constants, AgentCmd) {
                $scope.init = function () {
                    $rootScope.$watch('example', function (newValue, oldValue) {
                        if ($rootScope.example !== null && $rootScope.example.Query !== '') {
                            $scope.db = '';
                            $scope.queryExplainData = [];
                            $scope.queryExplainError = '';
                            if ((newValue.Db !== null && newValue.Db !== '') ||
                                ($rootScope.query !== null && $rootScope.query.Tables !== null && $rootScope.query.Tables.length > 0)) {
                                if (newValue.Db !== null && newValue.Db !== '') {
                                    $scope.db = angular.copy(newValue.Db);
                                } else {
                                    $scope.db = angular.copy($rootScope.query.Tables[0]['Db']);
                                }
                                $scope.getQueryExplain();
                            }
                        }
                    });
                };

                $scope.explainErrorMsg = function() {
                    if ($rootScope.query === null ) {
                        return false;
                    }
                    var allowedFor56= ['SELECT', 'DELETE', 'INSERT', 'REPLACE', 'UPDATE'];
                    var ver = $rootScope.instance.Version.split('.');
                    var majorVersion = ver[0];
                    var minorVersion = ver[1];
                    var isNewer56 = majorVersion == 5 && minorVersion >= 6 || majorVersion > 5;
                    var action = $rootScope.query_abstract.split(' ')[0];
                    if (allowedFor56.indexOf(action) === -1) {
                        return 'MySQL cannot EXPLAIN ' + action + ' queries';
                    } else if (!isNewer56 && allowedFor56.indexOf(action) > 0) {
                        return 'MySQL 5.6 or newer and ' + action + ' privileges are required to EXPLAIN this ' + action + ' query';
                    } else {
                        return '';
                    }
                };

                $scope.getQueryExplain = function() {
                    var db = $scope.db;
                    var data = {
                        "UUID": $rootScope.instance.UUID,
                        "Db": db,
                        "Query": $rootScope.example.Query,
                        "Convert": true,  // agent will convert if not SELECT and MySQL <= 5.5 or >= 5.6 but no privs
                    };
                    var params = {
                        AgentUUID: $rootScope.config.AgentUUID,
                        Service: 'query',
                        Cmd: 'Explain',
                        Data: utf8_to_b64(JSON.stringify(data))
                    };

                    var agentCmd = new AgentCmd(params);
                    var p = AgentCmd.update({agent_uuid: $rootScope.config.AgentUUID}, agentCmd);
                    p.$promise
                        .then(function (data) {
                            $scope.queryExplain = true;
                            if (data.Error === '') {
                                if (data.hasOwnProperty('Data') && data.Data !== null) {
                                    var explain = JSON.parse(b64_to_utf8(data.Data));
                                    $scope.queryExplainData = explain.Classic;
                                    $scope.queryExplainError = '';
                                } else {
                                    $scope.queryExplainError = 'Unable to parse QAN API response.';
                                }
                            } else {
                                $scope.queryExplainError = data.Error;
                            }

                        })
                    .catch(function(resp) {
                        var msg = constants.DEFAULT_ERR;
                        if (resp.hasOwnProperty('data') && resp.data.hasOwnProperty('Error')) {
                            msg = constants.API_ERR;
                            msg = msg.replace('<err_msg>', resp.data.Error);
                        }
                        $rootScope.alerts.push({
                            'type': 'danger',
                            'msg': msg
                        });
                    });
                };

                $scope.init();

            }]);

    pplControllers.controller('TableInfoController', [
            '$scope',
            '$rootScope',
            '$filter',
            'constants',
            'Table',
            'AgentCmd',
            function($scope, $rootScope, $filter, constants, Table, AgentCmd) {
                $scope.init = function () {
                    $scope.dbTables = [];
                    $scope.toggleTableInfo = 'create';
                    $rootScope.$watch('query', function (newValue, oldValue) {
                        if ($rootScope.query !== null) {
                            if (newValue.Tables === null || newValue.Tables.length === 0 || newValue.Tables[0].Db === '') {
                                $scope.dbTables = [];
                                $scope.reset();
                            } else {
                                $scope.dbTables = newValue.Tables;
                                $scope.selectedDbTable = $scope.dbTables[0].Db + '.' + $scope.dbTables[0].Table;
                                $scope.getTableInfo();
                            }
                        }
                    });
                };

                $scope.reset = function () {
                    $scope.tblCreateError = null;
                    $scope.tblIndexError = null;
                    $scope.tblStatusError = null;
                    $scope.tblCreate = false;
                    $scope.tblStatus = [];
                    $scope.tblIndex = [];
                };

                $scope.updateTable = function () {
                    var tables = [];
                    var params = {
                        'queryId': $rootScope.query.Id
                    };
                    var tbls = $scope.dbTables;
                    for(var i=0; i<tbls.length; i++) {
                        if ($scope.dbTables[i].isPersistent !== false) {
                            tables.push(new Table({
                                'Db': tbls[i].Db,
                                'Table': tbls[i].Table
                            }));
                        }
                    }

                    var p = Table.update(params, tables);
                    p.$promise
                        .then(function (resp) {
                        })
                    .catch(function (resp) {})
                        .finally(function (resp) {});

                };

                $scope.getTableInfo = function() {
                    $scope.reset();
                    if ($scope.selectedDbTable === null) {
                        return null;
                    }
                    var dbTbl = $scope.selectedDbTable.split('.');
                    var db = dbTbl[0];
                    var tbl = dbTbl[1];
                    var db_tbl = $scope.selectedDbTable;

                    var data = {
                        "UUID": $rootScope.instance.UUID,
                        "Create": [{
                            "Db": db,
                            "Table": tbl
                        }],
                        "Index": [{
                            "Db": db,
                            "Table": tbl
                        }],
                        "Status": [{
                            "Db": db,
                            "Table": tbl
                        }],
                    };
                    var params = {
                        AgentUUID: $rootScope.config.AgentUUID,
                        Service: 'query',
                        Cmd: 'TableInfo',
                        Data: utf8_to_b64(JSON.stringify(data))
                    };

                    var agentCmd = new AgentCmd(params);
                    var p = AgentCmd.update({agent_uuid: $rootScope.config.AgentUUID}, agentCmd);
                    p.$promise
                        .then(function (data) {
                            $scope.tableInfo = JSON.parse(b64_to_utf8(data.Data));
                            if ($scope.tableInfo instanceof Object && 'Errors' in $scope.tableInfo[db_tbl]) {
                                var errors = $scope.tableInfo[db_tbl].Errors;
                                var msg;
                                for (var t=0; t<$scope.dbTables.length; t++) {
                                    if ($scope.dbTables[t].Db + '.' + $scope.dbTables[t].Table === $scope.selectedDbTable) {
                                        $scope.dbTables[t].isPersistent = false;
                                    }
                                }
                                for (var i=0; i<errors.length; i++) {
                                    if (errors[i].startsWith('SHOW CREATE')) {
                                        msg = constants.AGENT_ERR;
                                        $scope.tblCreateError = msg.replace('<err_msg>', errors[i]);
                                    }
                                    if (errors[i].startsWith('SHOW INDEX')) {
                                        msg = constants.AGENT_ERR;
                                        $scope.tblIndexError = msg.replace('<err_msg>', errors[i]);
                                    }
                                    if (errors[i].startsWith('SHOW TABLE STATUS')) {
                                        msg = constants.AGENT_ERR;
                                        $scope.tblStatusError = msg.replace('<err_msg>', errors[i]);
                                    }
                                }
                            }
                            // Get table create
                            if ($scope.tableInfo instanceof Object && 'Create' in $scope.tableInfo[db_tbl]) {
                                $scope.tblCreate = $scope.tableInfo[db_tbl].Create;
                                if ($scope.isNewTable) {
                                    $scope.updateTable();
                                    $scope.isNewTable = false;
                                }
                            }

                            // Get Status
                            if ($scope.tableInfo instanceof Object && 'Status' in $scope.tableInfo[db_tbl]) {
                                $scope.tblStatus = $scope.tableInfo[db_tbl].Status;
                            }

                            // Get indexes
                            if ($scope.tableInfo instanceof Object && 'Index' in $scope.tableInfo[db_tbl]) {
                                $scope.tblIndex = $scope.tableInfo[db_tbl].Index;
                            }
                        })
                    .catch(function(resp) {
                        var msg = constants.DEFAULT_ERR;
                        if (resp.hasOwnProperty('data') && resp.data.hasOwnProperty('Error')) {
                            msg = constants.API_ERR;
                            msg = msg.replace('<err_msg>', resp.data.Error);
                        }
                        $rootScope.alerts.push({
                            'type': 'danger',
                            'msg': msg
                        });
                    });
                };

                $scope.addDbTable = function() {
                    var dbTbl = $scope.dbTable.split('.');
                    var option = {
                        'Db': dbTbl[0],
                        'Table': dbTbl[1]
                    };
                    $scope.isNewTable = true;

                    if ($scope.dbTables.length === 0) {
                        $scope.dbTables = [option];
                    } else {
                        var isUniq = true;
                        for (var i=0; i<$scope.dbTables.length; i++) {
                            if (option.Db === $scope.dbTables[i].Db && option.Table === $scope.dbTables[i].Table) {
                                isUniq = false;
                                $scope.isNewTable = false;
                            }
                        }
                        if (isUniq) {
                            $scope.dbTables.unshift(option);
                        }
                    }
                    $scope.selectedDbTable = $scope.dbTables[0].Db + '.' + $scope.dbTables[0].Table;
                    $scope.getTableInfo();
                    $scope.dbTable = '';
                };


                $scope.init();

            }]);

    pplControllers.controller('ManagementController', [
            '$scope',
            '$rootScope',
            '$window',
            'constants',
            '$timeout',
            '$interval',
            '$filter',
            '$state',
            'Instance',
            'AgentCmd',
            'AgentStatus',
            'AgentLog',
            'Config',
            'instances',
            function($scope, $rootScope, $window, constants, $timeout, $interval, $filter,
                $state, Instance, AgentCmd, AgentStatus, AgentLog, Config, instances) {
                $scope.init = function () {
                    $scope.DEMO = constants.DEMO;
                    $scope.instances = instances.asArray.filter(function(i) {
                        return i.Subsystem !== 'os' && i.Subsystem !== 'agent';
                    });
                    $scope.agents = instances.asArray.filter(function(i) { return i.Subsystem === 'agent';});
                    $rootScope.instances = $scope.instances;
                    $scope.allInstances = instances.asArray;
                    $scope.instancesByUUID = instances.asDict;

                    $scope.subsystem = $state.params.subsystem;
                    $scope.MySQLUUID = $state.params.uuid;
                    $scope.instance = $rootScope.instance = $scope.instancesByUUID[$state.params.uuid];
                    $rootScope.DEMO = constants.DEMO;
                    $scope.logTimeFrame = '1 h';
                    $scope.severityLeveles = [
                        'emerg', 'alert', 'crit', 'err',
                        'warning', 'notice', 'info', 'debug'
                    ];
                    $scope.initManagement();
                };

                $scope.initManagement = function () {
                    $scope.$on('$stateChangeSuccess', function(event, toState, toParams, fromState, fromParams) {

                        if ($state.is('management')) {
                            $scope.subsystem = toParams.subsystem;
                            $scope.MySQLUUID = toParams.uuid;
                            $scope.instance = $rootScope.instance = $scope.instancesByUUID[toParams.uuid];
                            switch (toParams.subsystem) {
                                case 'mysql':
                                    $timeout(function () {
                                        Config.query({instance_uuid: toParams.uuid})
                                            .$promise
                                            .then(function (resp) {
                                                for (var i=0; i<$scope.allInstances.length; i++) {
                                                    if (resp.AgentUUID === $scope.allInstances[i].UUID) {
                                                        $scope.selected_agent = $scope.allInstances[i];
                                                        $scope.getQanDefaults($scope.selected_agent);
                                                    }
                                                }

                                                $scope.agentData($scope.selected_agent.UUID);
                                            })
                                        .catch(function (resp) {
                                        })
                                        .finally(function() {});
                                    }, 200);
                                    break;
                                case 'server-info':
                                    $timeout(function () {
                                    for (var i = 0; i < $scope.agents.length; i++) {
                                        if ($scope.agents[i].ParentUUID === $scope.instance.ParentUUID) {
                                            $scope.selected_agent = $scope.agents[i];
                                            $scope.agent = $scope.agents[i];
                                        }
                                    }

                                    $scope.getServerSummary($scope.agent);
                                    $scope.getMySQLSummary($scope.agent);
                                    }, 200);
                                    break;
                                default:
                                    $scope.MySQLUUID = false;
                                    break;
                            }
                        }
                    });
                };

                $scope.getServerSummary = function(agent) {

                    var params = {
                        AgentUUID: agent.UUID,
                        Service: 'agent',
                        Cmd: 'GetServerSummary',
                    };
                    $scope.serverSummaryError = '';
                    var agentCmd = new AgentCmd(params);
                    var p = AgentCmd.update({agent_uuid: agent.UUID}, agentCmd);
                    p.$promise
                        .then(function (data) {
                            $rootScope.isAgentConnected = true;
                            if (data.Error === "") {
                                var str = window.atob(data.Data);
                                str = str.replace(/\\n/g, "\n");
                                str = str.slice(1, -1);
                                $scope.serverSummary = str;
                            } else {
                                if (data.Error === 'Executable file not found in $PATH') {
                                    data.Error += ' - Please install `pt-summary`.';
                                }
                                $scope.serverSummaryError = data.Error;
                            }
                        })
                    .catch(function(resp) {
                        $rootScope.isAgentConnected = false;
                        $scope.serverSummaryError = resp.data.Error;
                    });
                };

                $scope.getMySQLSummary = function(agent) {

                    var params = {
                        AgentUUID: agent.UUID,
                        Service: 'agent',
                        Cmd: 'GetMySQLSummary',
                    };
                    $scope.mysqlSummaryError = '';
                    var agentCmd = new AgentCmd(params);
                    var p = AgentCmd.update({agent_uuid: agent.UUID}, agentCmd);
                    p.$promise
                        .then(function (data) {
                            $rootScope.isAgentConnected = true;
                            if (data.Error === "") {
                                var str = window.atob(data.Data);
                                str = str.replace(/\\n/g, "\n");
                                str = str.slice(1, -1);
                                $scope.mysqlSummary = str;
                            } else {
                                if (data.Error === 'Executable file not found in $PATH') {
                                    data.Error += ' - Please install `pt-mysql-summary`.';
                                }
                                $scope.mysqlSummaryError =  data.Error;
                            }
                        })
                    .catch(function(resp) {
                        $rootScope.isAgentConnected = false;
                        $scope.mysqlSummaryError =  resp.data.Error;
                    });
                };

                $scope.agentData = function(uuid) {
                    $scope.agent = $scope.instancesByUUID[uuid];
                    $scope.getAgentStatus($scope.agent);
                    $scope.getAgentLog($scope.agent, $scope.logTimeFrame);
                };

                $scope.getAgentStatus = function (agent) {
                    $interval.cancel($scope.statusUpdatedFromNowObj);
                    var updated = moment();
                    $scope.statusUpdatedFromNow = updated.fromNow();
                    $scope.statusUpdatedFromNowObj = $interval(function() {
                        $scope.statusUpdatedFromNow = updated.fromNow();
                    }, 60000);
                    AgentStatus.query({agent_uuid: agent.UUID})
                        .$promise
                        .then(function (resp) {
                            $scope.agentStatus = resp;
                            var qanAnalyzerKey = Object.keys($scope.agentStatus)
                                .filter(function(v) {
                                    return v.startsWith('qan-analyzer') && !v.endsWith('interval') && !v.endsWith('worker');
                                });
                            $scope.agentStatus['qan-analyzer'] = resp[qanAnalyzerKey];

                        })
                    .catch(function (resp) {
                        var msg = constants.DEFAULT_ERR;
                        if (resp.hasOwnProperty('data') && resp.data !== null && resp.data.hasOwnProperty('Error')) {
                            msg = constants.API_ERR;
                            msg = msg.replace('<err_msg>', resp.data.Error);
                        }
                        $rootScope.alerts.push({
                            'type': 'danger',
                            'msg': msg
                        });
                    })
                    .finally(function (resp) {});
                };

                $scope.getAgentLog = function (agent, period) {
                    period = period.split(' ');
                    var begin = moment.utc().subtract(period[0], period[1]).format(constants.DTM_FORMAT);
                    var end = moment.utc().format(constants.DTM_FORMAT);
                    var params = {
                        agent_uuid: agent.UUID,
                        begin: begin,
                        end: end
                    };
                    AgentLog.query(params)
                        .$promise
                        .then(function (resp) {
                            $scope.agentLog = resp;
                        })
                    .catch(function (resp) {
                        var msg = constants.DEFAULT_ERR;
                        if (resp.hasOwnProperty('data') && resp.data !== null && resp.data.hasOwnProperty('Error')) {
                            msg = constants.API_ERR;
                            msg = msg.replace('<err_msg>', resp.data.Error);
                        }
                        $rootScope.alerts.push({
                            'type': 'danger',
                            'msg': msg
                        });
                    })
                    .finally(function (resp) {});
                };

                /**
                 * Get QAN defaults
                 */
                $scope.getQanDefaults = function (agent) {

                    var data = {
                         "UUID": $scope.MySQLUUID
                    };
                    var params = {
                        AgentUUID: agent.UUID,
                        Service: 'agent',
                        Cmd: 'GetDefaults',
                        Data: utf8_to_b64(JSON.stringify(data))
                    };

                    var agentCmd = new AgentCmd(params);
                    var p = AgentCmd.update({agent_uuid: agent.UUID}, agentCmd);
                    p.$promise
                        .then(function (data) {
                            if (data.Error !== "") {
                                var msg = constants.API_ERR;
                                msg = msg.replace('<err_msg>', data.Error);
                                $rootScope.alerts.push({
                                    'type': 'danger',
                                    'msg': msg
                                });
                            } else {
                                $rootScope.isAgentConnected = true;
                                var res = JSON.parse(b64_to_utf8(data.Data));
                                $scope.qanConf = res.qan;
                                $scope.qanConf.MaxSlowLogSize = numeral($scope.qanConf.MaxSlowLogSize).format('0b');
                                $scope.qanConf.Interval = moment.duration($scope.qanConf.Interval, 's').asMinutes();
                            }
                        })
                    .catch(function(resp) {
                        $rootScope.isAgentConnected = false;
                    })
                    .finally(function() {});
                };

                $scope.setQanConfig = function (selected_agent) {

                    var data = {
                        "UUID": $scope.instance.UUID,
                        "Interval": $scope.qanConf.Interval * 60,
                        "ExampleQueries": $scope.qanConf.ExampleQueries,
                        "CollectFrom": $scope.qanConf.CollectFrom
                    };
                    var restartParams = {
                        AgentUUID: selected_agent.UUID,
                        Service: 'qan',
                        Cmd: 'RestartTool',
                        Data: utf8_to_b64(JSON.stringify(data))
                    };

                    var restartAgentCmd = new AgentCmd(restartParams);
                    var p = AgentCmd.update({agent_uuid: selected_agent.UUID}, restartAgentCmd);
                    p.$promise
                        .then(function (resp) {
                            if (resp.Error !== '') {
                                $rootScope.showAlert(null, resp.Error);
                            } else {
                                var msg = 'Query Analytics configuration was applied.';
                                $rootScope.showAlert(null, '', msg, 'info');
                            }
                        })
                    .catch(function(resp) {
                        $rootScope.showAlert(resp);
                    })
                    .finally(function() {});

                };

                 $rootScope.changeInstance = function(instance) {
                    $rootScope.instance = instance;
                        $state.go('management', {
                            'subsystem': $state.params.subsystem,
                            'uuid': $rootScope.instance.UUID
                        });
                };

                $rootScope.goToQueries = function(instance) {
                    $state.go('root.instance-dt', {
                        uuid: $rootScope.instance.UUID,
                    }, { reload: true });
                };

                $scope.init();

            }]);

})();
