'use strict';

const assert = require('assert');
const _ = require('lodash');
const aggregate = require('../promise-aggregate');

const matches = (options, expected) => {
  const subset = _.pick(options, _.keys(expected));
  return _.isEqual(subset, expected);
};

describe('Make sure options are interpreted correctly', () => {

  it('defaults:', () => {
    const options = aggregate(a => a).options;
    console.log('options = ', options);
    const expected = {
      mode: 'NULL',
      maxWait: 300,
      minInterval: 300,
      aggInterval: 0
    };
    assert(matches(options, expected));
  });

  it('setting mode, replaceArgs, maxWait, minInterval, and aggInterval overrides defaults', () => {
    const mode = 'ERROR';
    const replaceArgs = a => a;
    const maxWait = 6767;
    const minInterval = 234;
    const aggInterval = 438034;
    const options = aggregate(a => a, {
      mode, replaceArgs, maxWait, minInterval, aggInterval
    }).options;
    console.log('options = ', options);
    const expected = {
      mode,
      replaceArgs,
      maxWait,
      minInterval,
      aggInterval
    };
    assert(matches(options, expected));
  });
});
