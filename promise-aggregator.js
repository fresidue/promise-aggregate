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
  leading: true,
  middle: true,
  wait: 300, // ms
  maxWait: null,
  minInterval: null,
  aggregationInterval: null,
};

// wrap the aggregate functionality in options handling, so we can separate
// out the messy options validation etc.
const applyOptions = (inputFn, opts) => {
  // the fleshed out options
  const options = Object.assign({}, defaultOptions, opts);
  options.aggregationInterval = options.aggregationInterval || options.wait;
  options.minInterval = options.minInterval || options.wait;
  options.maxWait = options.middle ? options.maxWait || options.wait : null;
  assert(typeof options.replaceArgs === 'function', 'replaceArgs is not a function');
  assert(Number.isFinite(options.wait) && options.wait > 0, 'wait is not a positive number');
  assert(Number.isFinite(options.aggregationInterval) && options.aggregationInterval > 0, 'aggregationInterval is not a positive number');
  assert(Number.isFinite(options.minInterval) && options.minInterval > 0, 'minInterval is not a positive number');
  if (options.middle) {
    assert(Number.isFinite(options.maxWait) && options.maxWait > 0, 'maxWait is not a positive number');
  } else {
    assert(!options.maxWait, '!maxWait should true')
  }
  // wait and middle are redundant
  // delete options.wait;
  // delete options.middle;
  // console.log('options = ', options);

  const aggregator = createAggregator(inputFn, options);
  aggregator.options = options;
  return aggregator;
};

const createAggregator = (inputFn, options) => {
  // and the mutable state of this object
  const state = {
    isLeading: true,
    args: null,
    scheduled: null,
    triggeredAt: 0, // i.e. 1970
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
          return Promise.reject(new Error('scheduled throttle-event was cancelled'))
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
      // and start a new trailing wait (this can result in !oldState.args)
      state.scheduled = schedule(options.wait);
      // otherwise we definitely run
      state.runAt = now;
      state.triggeredAt = now;
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
    const replacementArgs = options.replaceArgs(args, oldState.args);
    const now = Date.now();
    state.triggeredAt = now;
    // first deal with an idle throttle
    if (!state.scheduled) {
      // console.log('got nothing scheduled');
      state.scheduled = schedule(options.wait);
      state.runAt = now; // either way this needs to be set
      if (options.leading) {
        state.args = null;
        return Promise.resolve(inputFn.apply(null, replacementArgs));
      } else {
        state.args = replacementArgs;
        return state.scheduled;
      }
    }
    // otherwise deal with the old scheduled, and create a new
    else {
      // console.log('got args scheduled: ', state.args);
      const middleWait = oldState.runAt + options.wait - now;
      const wait = options.middle ? middleWait : options.wait;
      // it IS an edgecase, but the timing CAN be such that wait < 0 (especially
      // if the calls are coming in very quickly). If so, just execute directly
      if (wait < 0) {
        state.scheduled = schedule(options.wait);
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

module.exports = applyOptions;
module.exports.modes = modes;
module.exports.defaultOptions = defaultOptions;
