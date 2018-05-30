'use strict';

const _ = require('lodash');
const delay = require('delay');

const modes = {
  NULL: 'NULL',
  ERROR: 'ERROR',
  RESOLVE: 'RESOLVE'
};

const defaultOptions = {
  wait: 200,
  mode: modes.NULL,
  leading: true,  // xooop   xp  xoop
  middle: true,
  replaceArgs: (args, prev) => args, // in case we want to accumulate, allow customizer
};

const throttleP = (inputFn, opts) => {
  // the fleshed out options
  const options = _.assign({}, defaultOptions, opts);
  // and the mutable state of this object
  const state = {
    args: null,
    scheduled: null,
    triggeredAt: 0, // i.e. 1970
    runAt: 0, // i.e. new Date(0).valueOf()
  };

  // the schedule manages itself
  const schedule = wait => {
    let wasCancelled = false;
    // console.log('scheduling wait = ', wait);
    // just get the delay portion
    let scheduled = delay(wait);
    // save this guy for later
    const clear = scheduled.clear;
    // and continue
    const start = Date.now();
    scheduled = scheduled.then(() => {
      // First take care of case where schedule was cancelled
      // i.e. the cancel function was called before delay was done
      // Inside this if case, scheduled !== state.scheduled (!!)
      if (wasCancelled) {
        // console.log('was cancelled');
        if (state.mode === modes.RESOLVE) {
          // wasCancelled holds the next schedule to be made
          return wasCancelled;
        } else if (state.mode === modes.ERROR) {
          return Promise.reject(new Error('scheduled throttle-event was cancelled'))
        } else {
          // modes.NULL
          return null;
        }
      }
      // otherwise copy and reset the state
      const now = Date.now();
      // console.log('NOT cancelled. wait = ', wait, ' diff = ', (now - start));
      // console.log('args = ', state.args);
      const oldState = _.assign({}, state);
      state.scheduled = null; // cause it succeeded
      state.args = null;
      // If the state did not have args, then nothing is listening anyway. just exit
      if (!oldState.args) {
        return Promise.resolve();
      }
      // otherwise we definitely run
      state.runAt = now;
      // and start a new trailing wait (this can result in !oldState.args)
      state.scheduled = schedule(options.wait);
      // and return the function
      return Promise.resolve().then(() => inputFn.apply(null, oldState.args));
    });

    scheduled.cancel = nextScheduled => {
      wasCancelled = nextScheduled || true;
      clear();
    };

    return scheduled;
  };

  // define wrapper with 'function' to get access to 'arguments'
  const wrapper = function () {
    const args = (arguments.length === 1 ? [arguments[0]] : Array.apply(null, arguments));
    // console.log('\nstate', args, ' = ', state);
    const oldState = _.assign({}, state);
    const now = Date.now();
    state.triggeredAt = now;
    // first deal with an idle throttle
    if (!state.scheduled) {
      state.scheduled = schedule(options.wait);
      state.runAt = now; // either way this needs to be set
      if (options.leading) {
        state.args = null;
        return Promise.resolve().then(() => inputFn.apply(null, args));
      } else {
        state.args = args;
        return state.scheduled;
      }
    }
    // otherwise deal with the old scheduled, and create a new
    else {
      const trailingWait = Math.max(0, oldState.triggeredAt + options.wait - now);
      const middleWait = Math.max(0, oldState.runAt + options.wait - now);
      const wait = options.middle ? middleWait : trailingWait;
      state.scheduled = schedule(wait);
      state.args = options.replaceArgs(args, oldState.args);
      // console.log('cancelling oldState with args: ', oldState.args);
      oldState.scheduled.cancel(state.mode === modes.RESOLVE ? state.scheduled : true);
      return state.scheduled;
    }
  };

  return wrapper;
};

module.exports = throttleP;
