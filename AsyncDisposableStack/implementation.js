'use strict';

/* eslint no-invalid-this: 0 */

var GetIntrinsic = require('get-intrinsic');

var $ReferenceError = require('es-errors/ref');
var $TypeError = require('es-errors/type');
var $Promise = GetIntrinsic('%Promise%', true);

var AddDisposableResource = require('../aos/AddDisposableResource');
var Call = require('es-abstract/2025/Call');
var CreateMethodProperty = require('es-abstract/2023/CreateMethodProperty');
var DefinePropertyOrThrow = require('es-abstract/2025/DefinePropertyOrThrow');
var DisposeResources = require('../aos/DisposeResources');
var IsCallable = require('es-abstract/2025/IsCallable');
var NewDisposeCapability = require('../aos/NewDisposeCapability');
var NewPromiseCapability = require('es-abstract/2025/NewPromiseCapability');
var NormalCompletion = require('es-abstract/2025/NormalCompletion');

var SLOT = require('internal-slot');
var setToStringTag = require('es-set-tostringtag');
var supportsDescriptors = require('define-properties').supportsDescriptors;
var callBind = require('call-bind');
var callBound = require('call-bound');

var $then = callBound('Promise.prototype.then', true);

var symbolAsyncDispose = require('../Symbol.asyncDispose/polyfill')();

var AsyncDisposableStack = function AsyncDisposableStack() {
	if (
		!(this instanceof AsyncDisposableStack)
		|| SLOT.has(this, '[[AsyncDisposableState]]')
		|| SLOT.has(this, '[[DisposeCapability]]')
	) {
		throw new $TypeError('can only be used with new');
	}
	SLOT.set(this, '[[AsyncDisposableState]]', 'pending');
	SLOT.set(this, '[[DisposeCapability]]', NewDisposeCapability());
};

var disposed = function disposed() {
	var asyncDisposableStack = this; // step 1

	SLOT.assert(asyncDisposableStack, '[[AsyncDisposableState]]'); // step 2

	return SLOT.get(asyncDisposableStack, '[[AsyncDisposableState]]') === 'disposed'; // steps 3-4
};
var isDisposed = callBind(disposed);
if (supportsDescriptors) {
	DefinePropertyOrThrow(AsyncDisposableStack.prototype, 'disposed', {
		'[[Configurable]]': true,
		'[[Enumerable]]': false,
		'[[Get]]': disposed
	});
} else {
	AsyncDisposableStack.prototype.disposed = false;
}

var markDisposed = function markDisposed(asyncDisposableStack) {
	SLOT.set(asyncDisposableStack, '[[AsyncDisposableState]]', 'disposed'); // step 4
	if (!supportsDescriptors) {
		asyncDisposableStack.disposed = true; // eslint-disable-line no-param-reassign
	}
};

// https://tc39.es/proposal-explicit-resource-management/#sec-asyncdisposablestack.prototype.disposeAsync
CreateMethodProperty(AsyncDisposableStack.prototype, 'disposeAsync', function disposeAsync() {
	var asyncDisposableStack = this; // step 1
	var promiseCapability = NewPromiseCapability($Promise); // step 2

	if (!SLOT.has(asyncDisposableStack, '[[AsyncDisposableState]]')) { // step 3
		Call(promiseCapability['[[Reject]]'], void undefined, [new $TypeError('`this` must be an AsyncDisposableStack')]); // step 3.a
		return promiseCapability['[[Promise]]']; // step 3.b
	}

	if (isDisposed(asyncDisposableStack)) { // step 4
		Call(promiseCapability['[[Resolve]]'], void undefined, [void undefined]); // step 4.a
		return promiseCapability['[[Promise]]']; // step 4.b
	}

	markDisposed(asyncDisposableStack); // step 5

	// step 6: Let result be DisposeResources(..., NormalCompletion(*undefined*)).
	// DisposeResources in the shim returns a Completion Record when no Await
	// effect was triggered (empty stack), or a Promise that resolves to a
	// Completion Record otherwise (the Promise stands in for the chain of
	// Await effects inside the spec's DisposeResources).
	var result = DisposeResources(SLOT.get(asyncDisposableStack, '[[DisposeCapability]]'), NormalCompletion(void undefined));

	var settle = function settle(completion) {
		if (completion.type() === 'throw') { // step 7: IfAbruptRejectPromise(result, promiseCapability)
			Call(promiseCapability['[[Reject]]'], void undefined, [completion.value()]);
		} else { // step 8 (after IfAbruptRejectPromise unwraps result)
			Call(promiseCapability['[[Resolve]]'], void undefined, [completion.value()]);
		}
	};

	if (result && typeof result.then === 'function') {
		$then(result, settle);
	} else {
		settle(result);
	}

	return promiseCapability['[[Promise]]']; // step 9
});

CreateMethodProperty(AsyncDisposableStack.prototype, 'use', function use(value) {
	var asyncDisposableStack = this; // step 1

	if (isDisposed(asyncDisposableStack)) { // steps 2-3
		throw new $ReferenceError('a disposed stack can not use anything new'); // step 3
	}

	AddDisposableResource(SLOT.get(asyncDisposableStack, '[[DisposeCapability]]'), value, 'ASYNC-DISPOSE'); // step 4

	return value; // step 5
});

CreateMethodProperty(AsyncDisposableStack.prototype, 'adopt', function adopt(value, onDisposeAsync) {
	var asyncDisposableStack = this; // step 1

	if (isDisposed(asyncDisposableStack)) { // steps 2-3
		throw new $ReferenceError('a disposed stack can not use anything new'); // step 3
	}

	if (!IsCallable(onDisposeAsync)) {
		throw new $TypeError('`onDisposeAsync` must be a function'); // step 4
	}

	// eslint-disable-next-line no-sequences
	var F = (0, function () { // steps 5-7
		return Call(onDisposeAsync, void undefined, [value]);
	});

	F.value = value;
	AddDisposableResource(SLOT.get(asyncDisposableStack, '[[DisposeCapability]]'), void undefined, 'ASYNC-DISPOSE', F); // step 8

	return value; // step 9
});

CreateMethodProperty(AsyncDisposableStack.prototype, 'defer', function defer(onDisposeAsync) {
	var asyncDisposableStack = this; // step 1

	if (isDisposed(asyncDisposableStack)) { // steps 2-3
		throw new $ReferenceError('a disposed stack can not defer anything new'); // step 3
	}

	if (!IsCallable(onDisposeAsync)) {
		throw new $TypeError('`onDispose` must be a function'); // step 4
	}

	AddDisposableResource(SLOT.get(asyncDisposableStack, '[[DisposeCapability]]'), void undefined, 'ASYNC-DISPOSE', onDisposeAsync); // step 5
});

CreateMethodProperty(AsyncDisposableStack.prototype, 'move', function move() {
	var asyncDisposableStack = this; // step 1

	if (isDisposed(asyncDisposableStack)) { // steps 2-3
		throw new $ReferenceError('a disposed stack can not use anything new'); // step 3
	}

	var newAsyncDisposableStack = new AsyncDisposableStack(); // step 4-5
	SLOT.set(newAsyncDisposableStack, '[[DisposeCapability]]', SLOT.get(asyncDisposableStack, '[[DisposeCapability]]')); // step 6
	SLOT.set(asyncDisposableStack, '[[DisposeCapability]]', NewDisposeCapability()); // step 7
	markDisposed(asyncDisposableStack); // step 8

	return newAsyncDisposableStack; // step 9
});

if (symbolAsyncDispose) {
	CreateMethodProperty(
		AsyncDisposableStack.prototype,
		symbolAsyncDispose,
		AsyncDisposableStack.prototype.disposeAsync
	);
}

setToStringTag(AsyncDisposableStack.prototype, 'AsyncDisposableStack');

module.exports = AsyncDisposableStack;
