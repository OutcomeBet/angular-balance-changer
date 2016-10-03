(function() {
	var m = angular.module('nn.balanceChanger', []);

	m.factory('BalanceChanger', [function() {
		return {
			model: {},
			balanceField: '',
			method: '',
			methodPkField: '',
			type: null,
			amount: 0
		};
	}]);

	m.directive('balanceChangerControl', ['BalanceChanger', function(BalanceChanger) {
		return {
			restrict: 'E',
			require: 'ngModel',
			replace: true,
			template: '<div class="balance-changer-control"><button class="btn btn-xs btn-danger" ng-click="openModal($event, \'withdraw\')" title="{{ ::__(\'balanceChanger\', \'type.withdraw\') }}">-</button><span>{{ model[balanceField] | nnCurrency }}</span><button class="btn btn-xs btn-success" ng-click="openModal($event, \'deposit\')" title="{{ ::__(\'balanceChanger\', \'type.deposit\') }}">+</button></div>',
			link: function($scope, $el, attrs, ngModel) {
				$scope.model = null;
				$scope.balanceField = attrs.field || 'balance';
				var bc = BalanceChanger;

				ngModel.$render = function() {
					$scope.model = ngModel.$viewValue;
				}

				$scope.openModal = function($event, type) {
					bc.model = $scope.model;
					bc.balanceField = $scope.balanceField;
					bc.method = attrs.method || 'Cashier.Player.Balance.change';
					bc.methodPkField = attrs.methodPkField || 'playerId';
					bc.type = type;
					bc.amount = 0;

					$('#balance-changer-modal').modal('toggle');
				};
			}
		};
	}]);

	m.directive('balanceChangerModal', ['BalanceChanger', 'Remote', 'Alert', function(BalanceChanger, Remote, Alert) {
		return {
			restrict: 'C',
			link: function($scope, $el, attrs) {
				var bc = $scope.balanceChanger = BalanceChanger;

				$scope.change = function() {
					if(bc.amount <= 0) {
						$el.modal('toggle');
						return;
					}

					var value = Math.abs(bc.amount);
					if(bc.type === 'withdraw') {
						value = -value
					}

					var params = { amount: value };
					params[bc.methodPkField] = bc.model.id;

					Remote.call(bc.method, params).then(function(data) {
						safeApply($scope, function() {
							bc.model[bc.balanceField] = data.balanceAfter;
						});
						$el.modal('toggle');
					}).then(Alert.Small.Simple.Success);
				};
			}
		};
	}]);
})();
