(function() {
	angular.module('nn.balanceChanger', ['ui.bootstrap'])
	.run(['$templateCache', function($templateCache) {
		$templateCache.put('balance-changer/control.html', `
		<div class="balance-changer-control">
			<button class="btn btn-xs btn-danger" ng-click="$ctrl.open('withdraw')" ng-if="$ctrl.model.buttons.w" title="{{ ::__(\'balanceChanger\', \'type.withdraw\') }}">-</button>
			<button class="btn btn-xs btn-success" ng-click="$ctrl.open('deposit')" ng-if="$ctrl.model.buttons.d && !$ctrl.model.buttons.w" title="{{ ::__(\'balanceChanger\', \'type.deposit\') }}">+</button>
			<span>{{ $ctrl.model.subject.model[$ctrl.balanceField] | nnCurrency }}</span>
			<button class="btn btn-xs btn-success" ng-click="$ctrl.open('deposit')" ng-if="$ctrl.model.buttons.d && $ctrl.model.buttons.w" title="{{ ::__(\'balanceChanger\', \'type.deposit\') }}">+</button>
			<button class="btn btn-xs" ng-click="$ctrl.open('ss')" ng-if="$ctrl.model.buttons.ss && $root.Auth.cashier.can_move_sweepstakes" title="{{ ::__(\'balanceChanger\', \'type.sweepstakes\') }}">SS</button>
		</div>`);
	}])
	.component('balanceChangerControl', {
		templateUrl: 'balance-changer/control.html',
		bindings: {
			model: '=',
		},
		controller: [
			'$scope', '$uibModal', 'Auth', 'Remote', 'Alert',
			function($scope, $uibModal, Auth, Remote, Alert) {
				const model = this.model;

				// set defaults
				_.defaults(model, {
					amount: 0,
					method: 'Cashier.BankGroup.Transaction.moveMoney',
					buttons: {w: 1, d: 1, ss: 0},
					object: {type: 'bankGroup'},
					ssDirection: 'win2bet',
					bonus: null,
					balanceType: null,
				});

				// determine balance field
				if(model.subject.field) {
					if(model.subject.field.basic) {
						this.balanceField = model.subject.field.basic;
					} else {
						this.balanceField = model.subject.field;
					}
				} else {
					this.balanceField = 'balance';
				}

				model.balanceField = this.balanceField;

				this.open = function(type) {
					// set agent if possible
					if(Auth.agent) {
						model.object.model = Auth.agent;
					} else if(model.subject.type === 'playerId') {
						model.object.model = model.subject.model.bankGroup;
					} else if(model.subject.type === 'bankGroup') {
						model.object.model = model.subject.model.parent;
					}

					// set type
					model.type = type;

					// remove amount
					delete model.amount;

					// determine component
					let component = 'balanceChangerBasicComponent';
					if(type === 'ss') {
						component = 'balanceChangerSweepstakesComponent';
						model.type = model.ssDirection;
					} else if(model.balanceType === 'bonusBalance' || model.balanceType === 'wagerCounter') {
						component = 'balanceChangerBWComponent';
					}

					// open modal
					$uibModal.open({
						component,
						size: 'sm',
						resolve: {
							model,
						},
					});
				};
			}],
	})
	.component('balanceChangerBasicComponent', {
		templateUrl: `${VIEW_PATH}/partials/balance-changer/modal-basic.html`,
		bindings: {
			close: '&',
			dismiss: '&',
			resolve: '=',
		},
		controller($scope, Remote, Alert, $filter) {
			_.extend(this, this.resolve);
			const $ctrl = this;

			$ctrl.processing = true;

			$ctrl.validateBonus = () => {
				const depositMin = objPath($ctrl.model, 'bonus.deposit_min');
				const depositMax = objPath($ctrl.model, 'bonus.deposit_max');
				const amount = $ctrl.model.amount;

				return amount >= depositMin && amount <= depositMax;
			};

			$ctrl.ok = () => {
				if(_.isUndefined($ctrl.model.amount) || $ctrl.model.amount <= 0) {
					return Alert.Big.Simple.Error('Amount has to be positive and greater than zero.');
				}

				const params = {
					amount: $ctrl.model.amount,
				};

				let responseBalanceField = null;

				switch($ctrl.model.type) {
				case 'deposit':
					params.from = [$ctrl.model.object.type, objPath($ctrl.model.object.model, 'id')];
					params.to = [$ctrl.model.subject.type, objPath($ctrl.model.subject.model, 'id')];

					if(objPath($ctrl.model, 'bonus.bonus_id') && $ctrl.validateBonus()) {
						params.bonusId = $ctrl.model.bonus.bonus_id;
					}

					responseBalanceField = 'toBalanceAfter';
					break;
				case 'withdraw':
					params.from = [$ctrl.model.subject.type, objPath($ctrl.model.subject.model, 'id')];
					params.to = [$ctrl.model.object.type, objPath($ctrl.model.object.model, 'id')];

					responseBalanceField = 'fromBalanceAfter';
					break;

				default:
					return Alert.Big.Simple.Error('Undefined transaction type.');
				}

				const subject = $ctrl.model.subject;
				const balanceField = $ctrl.model.balanceField;

				$ctrl.processing = true;
				Remote.call('Cashier.BankGroup.Transaction.moveMoney', params)
					.then(function(data) {
						const balanceAfter = objPath(data, responseBalanceField);

						if(balanceAfter === undefined) {
							Alert.Big.Simple.Error('Undefined balance field.');
						} else {
							$ctrl.model.subject.model[balanceField] = balanceAfter;
						}

						$ctrl.close();
					})
					.then(Alert.Small.Simple.Success, (error) => {
						const wagerCoins = this.model.subject.model.wager;
						if(wagerCoins > 0) {
							const wager = $filter('nnCurrency')(wagerCoins);
							error += "<br>The player's current wager is: " + wager;
						}

						return Alert.Big.Simple.Error(error);
					})
					.finally(() => {
						// for an unknown reason it has to be like this
						$scope.$apply(() => {
							$ctrl.processing = false;
						});
					});
			};

			$ctrl.cancel = () => {
				$ctrl.dismiss();
			};

			$ctrl.allMoney = (flag) => {
				if(this.model.subject.type === 'playerId') {
					$ctrl.processing = true;

					const bankGroupId = this.model.subject.model.bank_group_id;
					const playerId = this.model.subject.model.id;

					// request available balance
					Remote.Cashier.Player.Balance.get({bankGroupId, playerId})
						.then((data) => {
							$ctrl.model.subject.balance = {
								available: data.balance,
								activeBonus: data.active_bonus,
								wager: data.wager,
							};

							if(flag) {
								// fill out the amount field with balance
								$ctrl.model.amount = data.balance;
							} else {
								if(angular.isNumber($ctrl.model.amount)) {
									// reset amount field to zero
									$ctrl.model.amount = 0;
								}
							}
						})
						.finally(() => {
							$ctrl.processing = false;
						});
				} else {
					$ctrl.processing = false;
				}
			};

			$ctrl.allMoney(false);

			// bonuses functions
			$ctrl.bonusValue = () => {
				const bonus = $ctrl.model.bonus;
				const amount = $ctrl.model.amount || 0;

				if(bonus.bonus_sum != null) {
					return parseInt(amount * bonus.bonus_percent / 10000);
				} if(bonus.bonus_percent != null) {
					return amount * bonus.bonus_percent / 10000;
				} else {
					Alert.Big.Simple.Error('Bonus is broken.');
					return 0;
				}
			};

			$ctrl.wagerValue = () => {
				const bonus = $ctrl.model.bonus;
				const amount = $ctrl.model.amount || 0;

				if(bonus.bonus_sum != null) {
					return parseInt(amount * bonus.bonus_percent / 10000);
				} if(bonus.bonus_percent != null) {
					return parseInt(amount * bonus.bonus_percent / 10000) * bonus.wager_coefficient / 10000;
				} else {
					Alert.Big.Simple.Error('Bonus is broken.');
					return 0;
				}
			};

			$ctrl.totalValue = () => {
				const amount = $ctrl.model.amount || 0;
				return amount + this.bonusValue();
			};
		},
	})
	.component('balanceChangerSweepstakesComponent', {
		templateUrl: `${VIEW_PATH}/partials/balance-changer/modal-sweepstakes.html`,
		bindings: {
			close: '&',
			dismiss: '&',
			resolve: '=',
		},
		controller(Remote, Alert) {
			_.extend(this, this.resolve);
			const $ctrl = this;

			$ctrl.processing = false;

			$ctrl.ok = () => {
				if(_.isUndefined($ctrl.model.amount) || $ctrl.model.amount <= 0) {
					return Alert.Big.Simple.Error('Amount has to be positive and greater than zero.');
				}

				const direction = $ctrl.model.type === 'bet2win' ? -1 : 1;
				const params = {
					amount: direction * $ctrl.model.amount,
					playerId: objPath($ctrl.model.subject.model, 'id'),
				};

				const subject = $ctrl.model.subject;

				$ctrl.processing = true;
				Remote.call('Cashier.Player.Balance.sweepstakesWin2Bet', params)
					.then(function(data) {
						if(subject.field.ss) {
							_.each(subject.field.ss, function(field) {
								subject.model[field] = objPath(data, field);
							});
						} else if(subject.model.balanceBet !== undefined && subject.model.balanceWin !== undefined) {
							subject.model.balanceBet = objPath(data, 'balanceBet');
							subject.model.balanceWin = objPath(data, 'balanceWin');
						} else {
							Alert.Big.Simple.Error('Unknown field. Nothing to update.');
						}

						$ctrl.close();
					})
					.then(Alert.Small.Simple.Success, Alert.Big.Simple.Error)
					.finally(() => {
						$ctrl.processing = false;
					});
			};

			$ctrl.cancel = () => {
				$ctrl.dismiss();
			};
		},
	})
	.component('balanceChangerBWComponent', {
		templateUrl: `${VIEW_PATH}/partials/balance-changer/modal-bw.html`,
		bindings: {
			close: '&',
			dismiss: '&',
			resolve: '=',
		},
		controller(Remote, Alert) {
			_.extend(this, this.resolve);
			const $ctrl = this;

			$ctrl.processing = false;

			$ctrl.ok = () => {
				if(_.isUndefined($ctrl.model.amount) || $ctrl.model.amount <= 0) {
					return Alert.Big.Simple.Error('Amount has to be positive and greater than zero.');
				}

				const params = {
					playerId: objPath($ctrl.model.subject.model, 'id'),
					wagerAmount: 0,
					bonusAmount: 0,
					bonusLimit:0,
					changeBalance: false,
				};

				const amount = $ctrl.model.type === 'deposit' ? $ctrl.model.amount : -$ctrl.model.amount;
				let responseBalanceField = null;

				switch($ctrl.model.balanceType) {
				case 'bonusBalance':
					params.bonusAmount = amount;
					responseBalanceField = 'bonusBalanceAfter';
					break;

				case 'bonusLimit':
					params.bonusLimit = amount;
					responseBalanceField = 'bonusLimitAfter';
					break;

				case 'wagerCounter':
					params.wagerAmount = amount;
					responseBalanceField = 'wagerCounterAfter';
					break;

				default:
					return Alert.Big.Simple.Error('Undefined balance type.');
				}

				const subject = $ctrl.model.subject;
				const balanceField = $ctrl.model.balanceField;

				$ctrl.processing = true;
				Remote.call('Cashier.Player.Bonus.Balance.change', params)
					.then(function(data) {
						const balanceAfter = objPath(data, responseBalanceField);

						if(balanceAfter === undefined) {
							Alert.Big.Simple.Error('Undefined balance field.');
						} else {
							$ctrl.model.subject.model[balanceField] = balanceAfter;
						}

						$ctrl.close();
					})
					.then(Alert.Small.Simple.Success, Alert.Big.Simple.Error)
					.finally(() => {
						$ctrl.processing = false;
					});
			};

			$ctrl.cancel = () => {
				$ctrl.dismiss();
			};
		},
	});
}());
