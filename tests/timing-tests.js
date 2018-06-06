'use strict';

const assert = require('assert');
const _ = require('lodash');
const delay = require('delay');
const timeSpan = require('time-span');
const sinon = require('sinon');

const throttle = require('../promise-aggregator');

console.log('\n\n\n\n\n\n\n');

// fn = throttled function
// argsStack = {time, args}
// cb - extra stuff
// done - the mocha done callback
const runSeries = (fn, argsStack, cb, done) => {
  const loop = (start, stack) => {
    // execute
    const {args} = stack.shift();
    const isLast = !stack.length;
    if (stack.length % 50 === 0) {
      console.info(stack.length + 'left');
    }
    fn.apply(null, args)
      .then(res => {
        // console.info('***********   args = ', args, ' res = ', res);
        return res;
      })
      .then(res => {
        cb && cb(res);
        isLast && done();
      })
      .catch(err => {
        cb && cb(err);
        isLast && done();
      });
    if (stack.length) {
      const {time} = stack[0];
      const now = Date.now();
      const diff = Math.max(0, start + time - now);
      delay(diff).then(() => {
        loop(start, stack);
      });
    }
  };
  loop(Date.now(), argsStack);
};

const createObjectsStack = times => {
  const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return _.map(times, (time, index) => {
    const a = letters[index];
    return {time, args: [{[a]: a}]};
  });
};

const createNumbersStack = times => {
  return _.map(times, (time, index) => ({time, args: [index + 1]}));
};

const isApproximatelyOver = (a, b) => {
  return a > (b - 2) && a < (b + 23);
};

const compactResults = (results, mode = throttle.modes.NULL) => {
  switch (mode) {
    case throttle.modes.NULL:
      return _.compact(results);
    case throttle.modes.REPEAT:
      return _.uniq(results);
    case throttle.modes.ERROR:
      return _.compact(_.map(results, r => r instanceof Error ? null : r));
    default:
      throw new Error('invalid mode');
  }
};

// ////
//
// // testing
//
// ////

const testConfigs = [
  {
    describe: 'if leading && middle',
    options: {
      wait: 100,
    },
    fn: a => a,
    times: [0, 20, 40, 60, 129, 169, 222],
    stackCreator: createNumbersStack,
    expectedNumNulls: 3,
    expectedNumErrors: 0,
    expectedCompacted: [1, 4, 6, 7],
    expectedResTimes: [0, 40, 60, 100, 169, 200, 300],
  },
  {
    describe: 'if !leading && middle',
    options: {
      wait: 100,
      leading: false,
    },
    fn: a => a,
    times: [0, 20, 40, 60, 129, 169, 222],
    stackCreator: createNumbersStack,
    expectedNumNulls: 4,
    expectedNumErrors: 0,
    expectedCompacted: [4, 6, 7],
    expectedResTimes: [20, 40, 60, 100, 169, 200, 300],
  },
  {
    describe: 'if leading && !middle',
    options: {
      wait: 100,
      middle: false
    },
    fn: a => a,
    times: [0, 20, 40, 155, 189, 300, 310],
    stackCreator: createNumbersStack,
    expectedNumNulls: 3,
    expectedNumErrors: 0,
    expectedCompacted: [1, 3, 5, 7],
    expectedResTimes: [0, 40, 140, 189, 289, 310, 410],
  },
  {
    describe: 'if !leading && !middle',
    options: {
      wait: 100,
      leading: false,
      middle: false
    },
    fn: a => a,
    times: [0, 20, 40, 155, 189, 300, 310],
    stackCreator: createNumbersStack,
    expectedNumNulls: 4,
    expectedNumErrors: 0,
    expectedCompacted: [3, 5, 7],
    expectedResTimes: [20, 40, 140, 189, 289, 310, 410],
  },
  {
    describe: 'using promises as input should work',
    options: {
      wait: 100,
    },
    fn: a => delay(20, a),
    times: [0, 20, 40, 60, 129, 169, 222],
    stackCreator: createNumbersStack,
    expectedNumNulls: 3,
    expectedNumErrors: 0,
    expectedCompacted: [1, 4, 6, 7],
    expectedResTimes: [20, 40, 60, 120, 169, 220, 320],
  },
  {
    describe: 'ERROR mode should work as expected',
    options: {
      wait: 100,
      mode: throttle.modes.ERROR
    },
    fn: a => a,
    times: [0, 20, 40, 60, 129, 169, 222],
    stackCreator: createNumbersStack,
    expectedNumNulls: 0,
    expectedNumErrors: 3,
    expectedCompacted: [1, 4, 6, 7],
    expectedResTimes: [0, 40, 60, 100, 169, 200, 300],
  },
  {
    describe: 'REPEAT mode should work as expected',
    options: {
      wait: 100,
      mode: throttle.modes.REPEAT
    },
    fn: a => a,
    times: [0, 20, 40, 60, 129, 169, 222],
    stackCreator: createNumbersStack,
    expectedNumNulls: 0,
    expectedNumErrors: 0,
    expectedCompacted: [1, 4, 6, 7],
    expectedResTimes: [0, 100, 100, 100, 200, 200, 300],
  },
  {
    describe: 'custom replaceArgs() with object accumulator (assign)',
    options: {
      wait: 100,
      replaceArgs: (args, prev) => {
        const acc = _.assign({}, _.get(prev, 0), _.get(args, 0));
        return [acc];
      }
    },
    fn: a => a,
    times: [0, 20, 40, 60, 129, 169, 222],
    stackCreator: createObjectsStack,
    expectedNumNulls: 3,
    expectedNumErrors: 0,
    expectedCompacted: [
      {a: 'a'},
      {b: 'b', c: 'c', d: 'd'},
      {e: 'e', f: 'f'},
      {g: 'g'}],
    expectedResTimes: [0, 40, 60, 100, 169, 200, 300],
  },
  {
    describe: 'custom replaceArgs() with array accumulator (assign)',
    options: {
      wait: 100,
      replaceArgs: (args, prev) => {
        const acc = _.get(prev, 0, []).slice();
        acc.push(_.get(args, 0));
        return [acc];
      }
    },
    fn: a => a,
    times: [0, 20, 40, 60, 129, 169, 222],
    stackCreator: createNumbersStack,
    expectedNumNulls: 3,
    expectedNumErrors: 0,
    expectedCompacted: [
      [1],
      [2, 3, 4],
      [5, 6],
      [7]
    ],
    expectedResTimes: [0, 40, 60, 100, 169, 200, 300],
  },

  {
    describe: 'time stress (just banging on it a bit)',
    options: {
      wait: 100,
    },
    fn: a => a,
    times: _.times(1001, i => 3 * i),
    stackCreator: createNumbersStack,
    expectedNumNulls: 970, // expect 31 non-nulls
  },

];

_.each(testConfigs, config => {
  describe(config.describe, () => {
    // set up the callback reporting
    let duration = null;
    const results = []; // will get filled up
    const resTimes = [];
    const cb = res => {
      resTimes.push(duration());
      results.push(res);
    };

    // create the data
    const fn = throttle(config.fn, config.options);
    const stack = config.stackCreator(config.times);
    before('run series', function (done) {
      this.timeout(config.times.slice().pop() * 2);
      duration = timeSpan();
      runSeries(fn, stack, cb, done);
    });

    // and run the tests
    const numTotal = config.times.length;
    it('should have ' + numTotal + ' results', () => {
      assert(results.length === numTotal);
    });

    if (config.expectedNumNulls || config.expectedNumNulls === 0) {
      it('of which ' + config.expectedNumNulls + ' should be null', () => {
        console.log('total duration = ', resTimes.slice().pop());
        const numNulls = _.filter(results, r => !r).length;
        assert(numNulls === config.expectedNumNulls, 'found ' + numNulls + ', expected ' + config.expectedNumNulls);
      });
    }

    if (config.expectedNumErrors || config.expectedNumErrors === 0) {
      it('of which ' + config.expectedNumErrors + ' should be errors', () => {
        const numErrors = _.filter(results, r => (r instanceof Error)).length;
        assert(numErrors === config.expectedNumErrors, 'found ' + numErrors + ', expected ' + config.expectedNumErrors);
      });
    }

    if (config.expectedCompacted) {
      it('expecting compacted responses to be ' + config.expectedCompacted, () => {
        const compacted = compactResults(results, config.options.mode);
        // console.log('compacted = ', compacted);
        assert(_.isEqual(compacted, config.expectedCompacted));
      });
    }

    if (config.expectedResTimes) {
      it('should have reasonable response times', () => {
        // console.log('response times = ', resTimes);
        // console.log('expected = ', config.expectedResTimes);
        assert(resTimes.length === 7, 'not enough restimes');
        assert(_.every(resTimes, t => _.isFinite(t) && t > 0));
        assert(_.every(resTimes, (t, i) => {
          return isApproximatelyOver(t, config.expectedResTimes[i]);
        }));
      });
    }
  });
});


// ////
//
// // other testing (?)
//
// ////

describe('stress testing and other stuff that doesn\'t fit above', () => {

  describe('with 50ms wait, call as many times as possible in 480ms (leading)', function (done) {
    this.timeout(50000);
    const results = [];
    const resTimes = [];
    // create the data
    before('run series', done => {
      const duration = timeSpan();
      const fn = throttle(a => a, {wait: 25});
      let count = 0;
      let lastFn = null;
      while (duration() < 501) {
        count += 1;
        lastFn = fn(count).then(res => {
          results.push(res);
          resTimes.push(duration());
          return Promise.resolve()
        })
        .catch(err => {
          console.log('got err: ', err.message);
          return err;
        });
      }
      console.log('lastFn = ', lastFn.toString());
      lastFn.then(() => {
        console.log('AM done&&: ', duration());
        done();
      });
    });

    const expected = [];
    const expNum = 22;
    // This one gets a bit squishy. I think it's just blowing up the
    // execution stack (?). The resTimes just don't make any sense
    it('expecting ca ' + expNum + ' compacted responses', () => {
      const compacted = compactResults(results);
      console.log('num results = ', results.length);
      console.log('compacted = ', compacted);
      const rt = _.map(compacted, c => resTimes[c - 1]);
      const allowed = compacted.length <= expNum && compacted.length > 0.6 * expNum;
      assert(allowed, 'should be around ' + expNum + ', is ' + compacted.length);
    });
  });

  it('make sure we export operations modes as expected', () => {
    const modes = throttle.modes;
    assert(_.size(modes) === 3);
    assert(modes.NULL === 'NULL');
    assert(modes.ERROR === 'ERROR');
    assert(modes.REPEAT === 'REPEAT');
  });
});
