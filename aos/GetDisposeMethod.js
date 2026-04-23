'use strict';

var GetIntrinsic = require('get-intrinsic');

var $SyntaxError = require('es-errors/syntax');
var $TypeError = require('es-errors/type');
var $Promise = GetIntrinsic('%Promise%', true);

var Call = require('es-abstract/2025/Call');
var GetMethod = require('es-abstract/2025/GetMethod');
var NewPromiseCapability = require('es-abstract/2025/NewPromiseCapability');

var isObject = require('es-abstract/helpers/isObject');

var symbolDispose = require('../Symbol.dispose/polyfill')();
var symbolAsyncDispose = require('../Symbol.asyncDispose/polyfill')();

// https://tc39.es/proposal-explicit-resource-management/#sec-getdisposemethod
module.exports = function GetDisposeMethod(V, hint) {
	if (!isObject(V)) {
		throw new $TypeError('Assertion failed: `V` must be an Object');
	}
	if (hint !== 'SYNC-DISPOSE' && hint !== 'ASYNC-DISPOSE') {
		throw new $SyntaxError('Assertion failed: `hint` must be `~SYNC-DISPOSE~` or `~ASYNC-DISPOSE~`');
	}

	var method;
	if (hint === 'ASYNC-DISPOSE') { // step 1
		if (symbolAsyncDispose) {
			method = GetMethod(V, symbolAsyncDispose); // step 1.a
		}
		if (method === void undefined) { // step 1.b
			if (!symbolDispose) {
				throw new $SyntaxError('`Symbol.dispose` is not supported');
			}
			method = GetMethod(V, symbolDispose); // step 1.b.i
			if (method !== void undefined) { // step 1.b.ii
				// step 1.b.ii.1: a closure that wraps a sync @@dispose so the
				// returned Promise is not awaited and any exception is not
				// thrown synchronously.
				return function () { // step 1.b.ii.3 (CreateBuiltinFunction)
					var O = this; // step 1.b.ii.1.a
					var promiseCapability = NewPromiseCapability($Promise); // step 1.b.ii.1.b
					try {
						Call(method, O); // step 1.b.ii.1.c (Completion(Call(method, O)))
					} catch (e) {
						// step 1.b.ii.1.d: IfAbruptRejectPromise
						Call(promiseCapability['[[Reject]]'], void undefined, [e]);
						return promiseCapability['[[Promise]]'];
					}
					Call(promiseCapability['[[Resolve]]'], void undefined, [void undefined]); // step 1.b.ii.1.e
					return promiseCapability['[[Promise]]']; // step 1.b.ii.1.f
				};
			}
		}
	} else { // step 2
		if (!symbolDispose) {
			throw new $SyntaxError('`Symbol.dispose` is not supported');
		}
		method = GetMethod(V, symbolDispose); // step 2.a
	}

	return method; // step 3
};
