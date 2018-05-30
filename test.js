'use strict';

const assert = require('assert');
const _ = require('lodash');
const delay = require('delay');
const timeSpan = require('time-span');
const sinon = require('sinon');

const throttle = require('./')

console.log('\n\n\n\n\n\n\n');

// fn = throttled function
// argsStack = {time, args}
// cb - extra stuff
// done - the mocha done callback
const runSeries = (fn, argsStack, cb, done) => {
  const loop = (start, stack) => {
    // execute
    const {args} = stack.shift();
    // console.log('LKLKJLKJ = ', args);
    const isLast = !stack.length;
    if (stack.length % 10 === 0) {
      console.info(stack.length + 'left');
    }
    fn.apply(null, args)
      .then(res => {
        console.info('***********   args = ', args, ' res = ', res);
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
  return a > (b - 2) && a < (b + 16);
};

// ////
//
// // testing 0
//
// ////

const testFlagsConfigs = [
  {
    describe: 'if leading && middle',
    options: {
      wait: 100,
      leading: true,
      middle: true
    },
    fn: a => a,
    times: [0, 20, 40, 60, 129, 169, 222],
    stackCreator: createNumbersStack,
    expectedNumExecuted: 4,
    expectedCompacted: [1, 4, 6, 7],
    expectedResTimes: [0, 40, 60, 100, 169, 200, 300],
  },
  {
    describe: 'if !leading && middle',
    options: {
      wait: 100,
      leading: false,
      middle: true
    },
    fn: a => a,
    times: [0, 20, 40, 60, 129, 169, 222],
    stackCreator: createNumbersStack,
    expectedNumExecuted: 3,
    expectedCompacted: [4, 6, 7],
    expectedResTimes: [20, 40, 60, 100, 169, 200, 300],
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
    expectedNumExecuted: 3,
    expectedCompacted: [3, 5, 7],
    expectedResTimes: [20, 40, 140, 189, 289, 310, 410],
  },
  {
    describe: 'using promises as input should work',
    options: {
      wait: 100,
      leading: true,
      middle: true
    },
    fn: a => delay(20, a),
    times: [0, 20, 40, 60, 129, 169, 222],
    stackCreator: createNumbersStack,
    expectedNumExecuted: 4,
    expectedCompacted: [1, 4, 6, 7],
    expectedResTimes: [20, 40, 60, 120, 169, 220, 320],
  },

];

_.each(testFlagsConfigs, config => {
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
    before('run series', done => {
      duration = timeSpan();
      runSeries(fn, stack, cb, done);
    });

    // and run the tests
    const numTotal = config.times.length;
    it('should have ' + numTotal + ' results', () => {
      console.log('res = ', results);
      assert(results.length === numTotal);
    });

    if (config.expectedNumExecuted) {
      it('of which 3 should not be null', () => {
        assert(_.compact(results).length === config.expectedNumExecuted);
      });
    }

    if (config.expectedCompacted) {
      it('expecting compacted responses to be ' + config.expectedCompacted, () => {
        assert(_.isEqual(_.compact(results), config.expectedCompacted));
      });
    }

    if (config.expectedResTimes) {
      it('should have reasonable response times', () => {
        console.log('response times = ', resTimes);
        console.log('expected = ', config.expectedResTimes);
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
// // testing
//
// ////


// describe('numbers stress', () => {
//   // stuff we'll be working with
//   const results = []; // will get filled up
//   const wait = 100;
//   const num = 100;
//   const diffs = (_.times(num - 1, () => (5 + Math.floor(Math.random() * 20))));
//   // console.log('diffs = ', diffs);
//
//   const times = [0];
//   _.each(diffs, diff => times.push(diff + times.slice().pop()));
//   console.log('times = ', times);
//   console.log('max = ', times.slice().pop());
//   // // const times = [0, 20, 40, 60, 129, 169, 222]; // a - g (7 elts)
//   const stack = createNumbersStack(times);
//   // const fn = throttle(obj => delay(10).then(() => obj), {wait});
//   const fn = throttle(a => a);
//   const cb = res => results.push(res);
//   //
//   // console.log('stack', stack);
//   before('', function (done) {
//     this.timeout(times.slice().pop() + 1000);
//     runSeries(fn, stack, cb, done);
//   });
//
//   it('should have ' + num + ' results', () => {
//     console.log('res = ' + JSON.stringify(results));
//     console.log('compact res = ', _.compact(results));
//     assert(results.length === num, 'only has ' + results.length + ' results');
//   });
// });
