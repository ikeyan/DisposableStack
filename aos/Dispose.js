'use strict';

var GetIntrinsic = require('get-intrinsic');

var $SyntaxError = require('es-errors/syntax');
var $Promise = GetIntrinsic('%Promise%', true);

var callBound = require('call-bound');
var $then = callBound('Promise.prototype.then', true);

var Call = require('es-abstract/2025/Call');
var PromiseResolve = require('es-abstract/2025/PromiseResolve');

var isObject = require('es-abstract/helpers/isObject');

// https://tc39.es/proposal-explicit-resource-management/#sec-dispose
module.exports = function Dispose(V, hint, method) {
	if (V !== void undefined && !isObject(V)) {
		throw new $SyntaxError('Assertion failed: `V` must be `undefined` or an Object');
	}
	if (hint !== 'SYNC-DISPOSE' && hint !== 'ASYNC-DISPOSE') {
		throw new $SyntaxError('Assertion failed: `hint` must be `~SYNC-DISPOSE~` or `~ASYNC-DISPOSE~`');
	}
	if (method !== void undefined && typeof method !== 'function') {
		throw new $SyntaxError('Assertion failed: `method` must be `undefined` or a function');
	}

	var result;
	if (method === void undefined) { // step 1
		result = void undefined;
	} else { // step 2
		result = Call(method, V);
	}

	if (hint === 'ASYNC-DISPOSE') { // step 3
		// step 3.a: Await(result). In JS this is represented as a Promise
		// that settles to ~undefined~ (or rejects if result rejects).
		return $then(PromiseResolve($Promise, result), function () {
			return void undefined; // step 4
		});
	}

	return void undefined; // step 4
};
