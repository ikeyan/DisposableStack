'use strict';

var $SyntaxError = require('es-errors/syntax');
var $TypeError = require('es-errors/type');

var IsCallable = require('es-abstract/2025/IsCallable');

var isObject = require('es-abstract/helpers/isObject');

var GetDisposeMethod = require('./GetDisposeMethod');

// https://tc39.es/proposal-explicit-resource-management/#sec-createdisposableresource
module.exports = function CreateDisposableResource(V, hint, method) {
	if (hint !== 'SYNC-DISPOSE' && hint !== 'ASYNC-DISPOSE') {
		throw new $SyntaxError('Assertion failed: `hint` must be `~SYNC-DISPOSE~` or `~ASYNC-DISPOSE~`');
	}

	var methodPresent = arguments.length > 2;
	if (!methodPresent) { // step 1
		if (V === null || V === void undefined) { // step 1.a
			// eslint-disable-next-line no-param-reassign
			V = void undefined; // step 1.a.i
			// step 1.a.ii: Set method to undefined. (already undefined since not passed)
		} else { // step 1.b
			if (!isObject(V)) {
				throw new $TypeError('`V` must be an Object, or `null` or `undefined`'); // step 1.b.i
			}
			// eslint-disable-next-line no-param-reassign
			method = GetDisposeMethod(V, hint); // step 1.b.ii
			if (method === void undefined) {
				throw new $TypeError('dispose method must not be `undefined` on `V` when an object `V` is provided'); // step 1.b.iii
			}
		}
	} else if (!IsCallable(method)) { // step 2
		throw new $TypeError('`method`, when provided, must be a function'); // step 2.a
	}

	return { // step 3
		'[[ResourceValue]]': V,
		'[[Hint]]': hint,
		'[[DisposeMethod]]': method
	};
};
