/**
 * Created by Shay on 07-Jun-15.
 */
var emitter = angular.module('emitter', ['ui.router', 'jsonFormatter', 'autocomplete']);


emitter.config(['$stateProvider', '$urlRouterProvider', function($stateProvider, $urlRouterProvider) {
    //
    // For any unmatched url, redirect to /state1
    $urlRouterProvider.otherwise("/");
    //
    // Now set up the states
    $stateProvider
        .state('emit', {
            url: '/',
            templateUrl: 'partials/emit.html',
            controller: 'EmitCtrl'
        });
}]);

emitter.controller('EmitCtrl', ['$scope', 'Emitter', function($scope, Emitter) {
    $scope.isEmitting = false;
    $scope.eventName = '';
    $scope.eventPayload = '';
    $scope.responseJSON = '';

    $scope.eventsCacheSent = Emitter.eventsCacheSent;
    $scope.eventsCacheRecieved = Emitter.eventsCacheRecieved;
    $scope.eventsEmitting = [];

    function displayJSONResponse(json) {
        $scope.responseJSON = json;
        $scope.isEmitting = false;
    }

    var doWhenEventReceived = function(response) {
        displayJSONResponse(response);
    };

    Emitter.setCallbackOnEvent(doWhenEventReceived);

    var doWhenEmittedUpdate = function(newEvents) {
        $scope.eventsEmitting = newEvents;
    }

    Emitter.setUpdateEmitted(doWhenEmittedUpdate)

    $scope.reloadFromCache = function(eventData) {
        $scope.eventName = eventData.name;
        $scope.eventPayload = JSON.stringify(eventData.payload);
        displayJSONResponse(eventData.payload);
    };

    $scope.emit = function() {
        $scope.eventPayload = $scope.eventPayload == '' ? '{}' : $scope.eventPayload;
        try {
            var parsedJSON = JSON.parse($scope.eventPayload);
        } catch (e) {
            displayJSONResponse(
                { error: "Unable to parse JSON payload" }
            );
            return;
        }
        Emitter.emit($scope.eventName, parsedJSON);
        $scope.isEmitting = true;
    };
}]);

emitter.factory('Emitter', [function() {
    return new function EmitterItem() {
        var self = this,
            socket = io(),
            eventRecievedCallback,
            emittedEventsUpdateCallback,
            connected = false;

        this.eventsCacheRecieved = [];
        this.eventsCacheSent = [];
        this.eventsListening = [];

        function registerEvent(event) {
            socket.on(event, function(response) {
                self.eventsCacheRecieved.push({ name: event, payload: response, time: getCurrentTime() });
                eventRecievedCallback(response);
            });
        }

        socket.on('connect', function() {
            self.connected = true;

            socket.on('list.listening.res', function(data) {
                self.eventsListening = data;

                for (var key in self.eventsListening) {
                    var event = self.eventsListening[key];
                    registerEvent(event)
                }

                socket.off('list.listening.res');
            })

            socket.on('list.emitting.res', function(data) {
                emittedEventsUpdateCallback(data);
                socket.off('list.emitting.res');
            })

            socket.emit('list.emitting', {});
            socket.emit('list.listening', {});
        });

        function getCurrentTime() {
            var date = new Date();
            return date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds() + ':' + date.getMilliseconds();
        }


        this.emit = function(event, payload) {
            socket.emit('event.emit', { event: event, data: payload });
            self.eventsCacheSent.push({ name: event, payload: payload, time: getCurrentTime() });
        };

        this.setCallbackOnEvent = function(callback) {
            eventRecievedCallback = callback;
        };

        this.setUpdateEmitted = function(callback) {
            emittedEventsUpdateCallback = callback;
        }

        this.isConnected = function() {
            return connected;
        };
    };
}]);

