'use strict';

const assert = require('assert');
const delay = require('delay');

const modes = {
  NULL: 'NULL', // default
  ERROR: 'ERROR',
  REPEAT: 'REPEAT'
};

const defaultOptions = {
  mode: modes.NULL,
  replaceArgs: (args, prev) => args, // in case we want to accumulate, allow customizer
  minInterval: 300,
  maxWait: 300,
  aggInterval: 0,
};

// wrap the aggregate functionality in options handling, so we can separate
// out the messy validation etc.
const applyOptions = (inputFn, opts) => {
  // the fleshed out options
  const options = Object.assign({}, defaultOptions, opts);
  assert(typeof options.replaceArgs === 'function', 'replaceArgs is not a function');
  assert(options.mode === modes.NULL || options.mode === modes.ERROR || options.mode === modes.REPEAT, 'invalid mode');
  assert(Number.isFinite(options.aggInterval) && options.aggInterval >= 0, 'aggInterval must be >= 0');
  assert(Number.isFinite(options.minInterval) && options.minInterval >= 0, 'minInterval must be >= 0');
  assert(Number.isFinite(options.maxWait) || options.maxWait === Infinity, 'maxWait must be a finite number');
  if (options.maxWait < 0) {
    options.maxWait = Infinity;
  }
  assert(options.maxWait >= options.minInterval, 'maxWait must be >= minInterval');

  const aggregator = createAggregator(inputFn, options);
  aggregator.options = options;
  return aggregator;
};

const createAggregator = (inputFn, options) => {
  // and the mutable state of this object
  const state = {
    args: null,
    scheduled: null,
    // triggeredAt: 0, // i.e. 1970
    firstTriggeredAt: null,
    runAt: 0, // i.e. new Date(0).valueOf()
  };

  // the schedule manages itself
  const schedule = wait => {
    let wasCancelled = false;
    // create the delay
    let scheduled = delay(wait);
    // grab a ref to this guy while we can (delay module specifics)
    const clear = scheduled.clear;
    // and continue
    scheduled = scheduled.then(() => {
      // First take care of case where schedule was cancelled
      // i.e. the cancel function was called before delay was done
      // Inside this if case, scheduled !== state.scheduled (!!)
      if (wasCancelled) {
        if (options.mode === modes.REPEAT) {
          // wasCancelled holds the next schedule to be made
          return wasCancelled;
        } else if (options.mode === modes.ERROR) {
          return Promise.reject(new Error('scheduled aggregate-event was cancelled'))
        } else { // modes.NULL
          return null;
        }
      }
      // otherwise copy and reset the state
      const now = Date.now();
      const oldState = Object.assign({}, state);
      state.scheduled = null; // cause it succeeded
      state.args = null;
      // If the state did not have args, then nothing is listening anyway. just exit
      if (!oldState.args) {
        return Promise.resolve();
      }
      // otherwise we definitely run
      // and start a new trailing wait (this can result in !oldState.args)
      state.firstTriggeredAt = null;
      state.runAt = now;
      state.scheduled = schedule(options.minInterval);
      return Promise.resolve(inputFn.apply(null, oldState.args));
    });

    scheduled.cancel = nextScheduled => {
      wasCancelled = nextScheduled || true;
      clear();
    };

    return scheduled;
  };

  // the main exposed wrapper that handles 'call' events from outside world
  const wrapper = function (...args) {
    const oldState = Object.assign({}, state);
    const replacementArgs = options.replaceArgs(args, state.args);
    const now = Date.now();

    const callDelay = state.runAt + options.minInterval - now;

    let wait = Math.max(callDelay, options.aggInterval);
    if (options.maxWait) {
      const maxWaitAllowed = state.firstTriggeredAt + options.maxWait - now;
      wait = Math.min(wait, maxWaitAllowed);
    }


    // state.triggeredAt = now;
    // first deal with an idle state
    if (!state.scheduled) {
      // console.log('got nothing scheduled');
      state.firstTriggeredAt = now;
      if (options.leading) {
        state.runAt = now;
        state.args = null;
        state.scheduled = schedule(options.minInterval);
        return Promise.resolve(inputFn.apply(null, replacementArgs));
      } else {
        state.firstTriggeredAt = now;
        state.args = replacementArgs;
        state.scheduled = schedule(options.aggInterval);
        return state.scheduled;
      }
    }
    // otherwise deal with the old scheduled, and create a new
    else {
      if (!state.firstTriggeredAt) {
        state.firstTriggeredAt = now;
      }
      // console.log('got args scheduled: ', state.args);
      const callDelay = oldState.runAt + options.minInterval - now;
      let wait = Math.max(callDelay, options.aggInterval);
      if (options.maxWait) {
        const maxWaitAllowed = state.firstTriggeredAt + options.maxWait - now;
        wait = Math.min(wait, maxWaitAllowed);
      }
      // const middleWait = oldState.runAt + options.wait - now;
      // const wait = options.middle ? middleWait : options.wait;
      // it IS an edgecase, but the timing CAN be such that wait < 0 (especially
      // if the calls are coming in very quickly). If so, just execute directly
      if (wait <= 0) {
        state.scheduled = schedule(options.wait);
        state.firstTriggeredAt = null;
        state.runAt = now;
        state.args = null;
        const rv =  Promise.resolve(inputFn.apply(null, replacementArgs));
        oldState.scheduled.cancel(options.mode === modes.REPEAT ? rv : true);
        return rv;
      } else {
        state.scheduled = schedule(wait);
        state.args = replacementArgs;
        oldState.scheduled.cancel(options.mode === modes.REPEAT ? state.scheduled : true);
        return state.scheduled;
      }
    }
  };
  return wrapper;
};

module.exports = {aggregate: applyOptions};
module.exports.modes = modes;
module.exports.defaultOptions = defaultOptions;
