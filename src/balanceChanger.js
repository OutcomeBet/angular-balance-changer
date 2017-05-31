(function() {
	var m = angular.module('nn.balanceChanger', []);

	m.factory('BalanceChanger', [function() {
		return {
			balanceField: '',
			method: '',
			type: null,
			amount: 0,
			params: {
				object: {
					type: null,
					model: {}
				},
				subject: {
					type: null,
					model: {}
				}
			}
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
				};

				$scope.openModal = function($event, type) {
					bc.method = attrs.method || 'Cashier.Player.Balance.change';
					bc.balanceField = $scope.balanceField;
					bc.type = type;

					bc.amount = null;
					bc.params = angular.extend({
						amount: 0,
						object: {
							type: null,
							model: {}
						},
						subject: {
							type: null,
							model: {}
						}
					}, $scope.$eval(attrs.params));
					bc.params.subject.model = $scope.model;

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
						Alert.Big.Simple.Error('Amount has to be positive and greater than zero.');
						return;
					}

					var params = {
						amount: bc.amount
					};

					var responseBalanceField = '';

					if(bc.params.method === 'Cashier.BankGroup.Transaction.moveMoney') {
						switch(bc.type) {
							case 'deposit':
								params.from = [bc.params.object.type, objPath(bc.params.object.model, 'id')];
								params.to = [bc.params.subject.type, objPath(bc.params.subject.model, 'id')];

								responseBalanceField = 'toBalanceAfter';
								break;
							case 'withdraw':
								params.from = [bc.params.subject.type, objPath(bc.params.subject.model, 'id')];
								params.to = [bc.params.object.type, objPath(bc.params.object.model, 'id')];

								responseBalanceField = 'fromBalanceAfter';
								break;
							default:
								Alert.Big.Simple.Error('Undefined transaction type.');
						}
					} else {
						Alert.Big.Simple.Error('Undefined method.');
					}

					Remote.call(bc.params.method, params).then(function(data) {
						var balanceAfter = objPath(data, responseBalanceField);
						if(balanceAfter === undefined) {
							Alert.Big.Simple.Error('Undefined balance field.');
						} else {
							safeApply($scope, function() {
								bc.params.subject.model[bc.balanceField] = balanceAfter;
							});
						}

						$el.modal('toggle');
					}).then(Alert.Small.Simple.Success, Alert.Big.Simple.Error);
				};
			}
		};
	}]);
})();
