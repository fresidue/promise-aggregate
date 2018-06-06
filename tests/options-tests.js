'use strict';

const assert = require('assert');
const _ = require('lodash');
const throttle = require('../promise-aggregator');

const matches = (options, expected) => {
  const subset = _.pick(options, _.keys(expected));
  return _.isEqual(subset, expected);
};

describe('Make sure options are interpreted correctly', () => {

  it('defaults:', () => {
    const options = throttle(a => a).options;
    console.log('options = ', options);
    const expected = {
      mode: 'NULL',
      leading: true,
      maxWait: 300,
      minInterval: 300,
      aggregationInterval: 300
    };
    assert(matches(options, expected));
  });

  it('wait propagates to maxWait, minInterval, and aggregationInterval', () => {
    const wait = 348;
    const options = throttle(a => a, {wait}).options;
    console.log('options = ', options);
    const expected = {
      mode: 'NULL',
      leading: true,
      maxWait: wait,
      minInterval: wait,
      aggregationInterval: wait
    };
    assert(matches(options, expected));
  });

  it('setting maxWait, minInterval, and aggregationInterval overrides wait', () => {
    const wait = 348;
    const maxWait = 6767;
    const minInterval = 234;
    const aggregationInterval = 438034;
    const options = throttle(a => a, {
      wait, maxWait, minInterval, aggregationInterval
    }).options;
    console.log('options = ', options);
    const expected = {
      mode: 'NULL',
      leading: true,
      maxWait,
      minInterval,
      aggregationInterval
    };
    assert(matches(options, expected));
  });

  it('setting middle = false overrides maxWait (!maxWait means infinity)', () => {
    const middle = false;
    const maxWait = 1234;
    const options = throttle(a => a, {
      middle, maxWait
    }).options;
    console.log('options = ', options);
    assert(!options.maxWait)
  });
});
