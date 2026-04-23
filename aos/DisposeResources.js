'use strict';

var GetIntrinsic = require('get-intrinsic');

var $TypeError = require('es-errors/type');
var $Promise = GetIntrinsic('%Promise%', true);

var callBound = require('call-bound');
var $then = callBound('Promise.prototype.then', true);

var Call = require('es-abstract/2025/Call');
var CompletionRecord = require('es-abstract/2025/CompletionRecord');
var PromiseResolve = require('es-abstract/2025/PromiseResolve');
var ThrowCompletion = require('es-abstract/2025/ThrowCompletion');

var SuppressedError = require('suppressed-error/polyfill')();

var noop = function noop() {};

// https://tc39.es/proposal-explicit-resource-management/#sec-disposeresources
module.exports = function DisposeResources(disposeCapability, startCompletion) {
	if (!(startCompletion instanceof CompletionRecord)) {
		throw new $TypeError('Assertion failed: `completion` must be a Completion Record');
	}

	var stack = disposeCapability['[[DisposableResourceStack]]'];

	var state = {
		completion: startCompletion,
		needsAwait: false, // step 1
		hasAwaited: false // step 2
	};

	// Fold a thrown value into `state.completion` per spec step 3.e.iii.
	var recordThrow = function recordThrow(value) {
		if (state.completion.type() === 'throw') { // step 3.e.iii.1
			var result = value; // step 3.e.iii.1.a
			var suppressed = state.completion.value(); // step 3.e.iii.1.b
			var error = new SuppressedError(result, suppressed); // steps 3.e.iii.1.c, 1.d, 1.e
			state.completion = ThrowCompletion(error); // step 3.e.iii.1.f
		} else { // step 3.e.iii.2
			state.completion = ThrowCompletion(value); // step 3.e.iii.2.a
		}
	};

	// JS has no synchronous Await, so each Await effect becomes a microtask
	// hop via `Promise.prototype.then`. The continuations below re-enter the
	// loop at the correct index once the Await settles. They are declared
	// outside of any loop to satisfy `no-loop-func`.
	var resumeAtSameIndex = function resumeAtSameIndex(savedI) {
		return function resumeAtSame() {
			return runLoop(savedI); // eslint-disable-line no-use-before-define
		};
	};
	var resumeAfterAsyncDispose = function resumeAfterAsyncDispose(savedI) {
		return function resumeAfterAsync() {
			return runLoop(savedI - 1); // eslint-disable-line no-use-before-define
		};
	};
	var recordAndResume = function recordAndResume(savedI) {
		return function asyncDisposeRejection(e) {
			recordThrow(e);
			return runLoop(savedI - 1); // eslint-disable-line no-use-before-define
		};
	};

	// Process the spec's reverse-order loop (step 3) starting at `startI`.
	// Returns `undefined` when processing has completed synchronously, or a
	// Promise whose resolution resumes the loop.
	var runLoop = function runLoop(startI) {
		var i = startI;
		while (i >= 0) {
			var resource = stack[i]; // step 3 (element access, reverse order)
			var value = resource['[[ResourceValue]]']; // step 3.a
			var hint = resource['[[Hint]]']; // step 3.b
			var method = resource['[[DisposeMethod]]']; // step 3.c

			if (hint === 'SYNC-DISPOSE' && state.needsAwait && !state.hasAwaited) { // step 3.d
				state.needsAwait = false; // step 3.d.ii
				// step 3.d.i: Await(undefined). Resume at the SAME `i` because
				// this resource has not yet been processed.
				return $then(PromiseResolve($Promise, void undefined), resumeAtSameIndex(i));
			}

			// eslint-disable-next-line no-negated-condition
			if (method !== void undefined) { // step 3.e
				// step 3.e.i: Let result be Completion(Call(method, value)).
				var callValue;
				var callThrew = false;
				try {
					callValue = Call(method, value);
				} catch (e) {
					callThrew = true;
					callValue = e;
				}

				if (!callThrew && hint === 'ASYNC-DISPOSE') { // step 3.e.ii
					state.hasAwaited = true; // step 3.e.ii.2
					// step 3.e.ii.1: Set result to Completion(Await(result.[[Value]])).
					// Resume at `i - 1` after the Await settles; a rejection is
					// folded into `state.completion` via step 3.e.iii.
					return $then(
						PromiseResolve($Promise, callValue),
						resumeAfterAsyncDispose(i),
						recordAndResume(i)
					);
				}

				if (callThrew) {
					recordThrow(callValue); // step 3.e.iii for a sync Call throw
				}
			} else { // step 3.f
				// step 3.f.i: Assert: hint is ~async-dispose~.
				state.needsAwait = true; // step 3.f.ii
			}

			i -= 1;
		}

		if (state.needsAwait && !state.hasAwaited) { // step 4
			// step 4.a: Await(undefined). Nothing to resume.
			return $then(PromiseResolve($Promise, void undefined), noop);
		}

		return void undefined;
	};

	var finalize = function finalize() {
		// step 5 (NOTE): the stack will never be used again.
		// eslint-disable-next-line no-param-reassign
		disposeCapability['[[DisposableResourceStack]]'] = []; // step 6
		return state.completion; // step 7
	};

	var pending = runLoop(stack.length - 1);
	if (pending && typeof pending.then === 'function') {
		return $then(pending, finalize);
	}
	return finalize();
};
