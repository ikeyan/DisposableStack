'use strict';

var $SyntaxError = require('es-errors/syntax');
var $TypeError = require('es-errors/type');

var isDisposeCapabilityRecord = require('./records/dispose-capability-record');

var CreateDisposableResource = require('./CreateDisposableResource');

var callBound = require('call-bound');

var $push = callBound('Array.prototype.push');

// https://tc39.es/proposal-explicit-resource-management/#sec-adddisposableresource
module.exports = function AddDisposableResource(disposeCapability, V, hint) {
	if (!isDisposeCapabilityRecord(disposeCapability)) {
		throw new $TypeError('Assertion failed: `disposeCapability` must be a DisposeCapability Record');
	}
	if (hint !== 'SYNC-DISPOSE' && hint !== 'ASYNC-DISPOSE') {
		throw new $SyntaxError('Assertion failed: `hint` must be `~SYNC-DISPOSE~` or `~ASYNC-DISPOSE~`');
	}
	var methodPresent = arguments.length > 3;
	var method = methodPresent ? arguments[3] : void undefined;
	if (methodPresent && typeof method !== 'function') {
		throw new $TypeError('Assertion failed: `method`, when present, must be a function');
	}

	var resource;
	// eslint-disable-next-line no-negated-condition
	if (!methodPresent) { // step 1
		if ((V === null || V === void undefined) && hint === 'SYNC-DISPOSE') { // step 1.a
			return 'UNUSED'; // step 1.a.i
		}
		// step 1.b: NOTE
		resource = CreateDisposableResource(V, hint); // step 1.c
	} else { // step 2
		// step 2.a: Assert: V is undefined.
		resource = CreateDisposableResource(void undefined, hint, method); // step 2.b
	}
	$push(disposeCapability['[[DisposableResourceStack]]'], resource); // step 3

	return 'UNUSED'; // step 4
};
