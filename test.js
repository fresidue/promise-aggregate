'use strict';

const assert = require('assert');
const _ = require('lodash');
const delay = require('delay');
const sinon = require('sinon');

const throttle = require('./')

// fn = throttled function
// dataStack = {time, args}
const runSeries = (fn, dataStack, cb, done) => {
  const loop = (start, stack) => {
    // execute
    const {args} = stack.shift();
    // console.log('LKLKJLKJ = ', args);
    const isLast = !stack.length;
    if (stack.length % 10 === 0) {
      console.log(stack.length + 'left');
    }
    fn.apply(null, args)
      .then(res => {
        console.log('***********   args = ', args, ' res = ', res);
        return res;
      })
      .then(res => (cb && cb(res)))
      .then(() => (isLast && done()));
    if (stack.length) {
      const {time} = stack[0];
      const now = Date.now();
      const diff = Math.max(0, start + time - now);
      delay(diff).then(() => {
        loop(start, stack);
      });
    }
  };
  loop(Date.now(), dataStack);
};

console.log('\n\n\n\n\n\n\n');

const createLetters = num => {
  const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const sub = letters.substring(0, num);
  return _.map(sub, x => ({[x]: x}));
};

const createObjectsStack = times => {
  const letters = createLetters(times.length);
  return _.map(_.zip(times, letters), ([time, obj]) => ({time, args: [obj]}));
};

const createNumbersStack = times => {
  return _.map(times, (time, index) => ({time, args: [index + 1]}));
};

describe('!!leading && !!middle', () => {
  // stuff we'll be working with
  const results = []; // will get filled up
  const wait = 100;

  const times = [0, 20, 40, 60, 129, 169, 222]; // a - g (7 elts)
  const stack = createNumbersStack(times);
  // const fn = throttle(obj => delay(10).then(() => obj), {wait});
  const fn = throttle(a => a, {wait});
  const cb = res => results.push(res);

  before('', done => {
    runSeries(fn, stack, cb, done);
  });

  it('should have 7 results', () => {
    console.log('results = ', results);
    assert(results.length === 7, 'only has ' + results.length + ' results');
  });
  it('of which 4 should not be null', () => {
    assert(_.compact(results).length === 4);
  });
  it('aggregating results should give expected', () => {
    assert(_.isEqual(_.compact(results), [1, 4, 6, 7]));
  });
});

// describe('numers stress', () => {
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
//   // it('of which 4 should not be null', () => {
//   //   assert(_.compact(results).length === 4);
//   // });
//   // it('aggregating results should give expected', () => {
//   //   const acc = _.map(_.compact(results), obj => _.keys(obj)[0]);
//   //   console.log('acc = ', acc);
//   //   const expected = ['a', 'd', 'f', 'g'];
//   //   assert(_.isEqual(acc, expected));
//   // });
// });

// describe('!leading && !!middle', () => {
//   // stuff we'll be working with
//   const results = []; // will get filled up
//   const wait = 100;
//   const times = [0, 20, 40, 60, 129, 169, 222]; // a - g (7 elts)
//   const stack = createObjectsStack(times);
//   const fn = throttle(obj => delay(10).then(() => obj), {wait, leading: false});
//   const cb = res => results.push(res);
//
//   console.log('stack', stack);
//   before('', done => {
//     runSeries(fn, stack, cb, done);
//   });
//
//   it('should have results 7', () => {
//     console.log('res = ', results);
//     assert(results.length === 7);
//   });
//   it('of which 3 should not be null', () => {
//     assert(_.compact(results).length === 3);
//   });
//   it('aggregating results should give expected', () => {
//     const acc = _.map(_.compact(results), obj => _.keys(obj)[0]);
//     console.log('acc = ', acc);
//     const expected = ['d', 'f', 'g'];
//     assert(_.isEqual(acc, expected));
//   });
// });
//
// describe('!leading && !middle', () => {
//   // stuff we'll be working with
//   const results = []; // will get filled up
//   const wait = 100;
//   const times = [
//     0,
//     20,
//     40, // should be trailing
//     155,
//     189, //this one too
//     300,
//     310, // and this one
//   ];
//   const stack = createObjectsStack(times);
//   const fn = throttle(obj => delay(10).then(() => obj), {wait, leading: false, middle: false});
//   const cb = res => results.push(res);
//
//   console.log('stack', stack);
//   before('', done => {
//     runSeries(fn, stack, cb, done);
//   });
//
//   it('should have results 7', () => {
//     console.log('res = ', results);
//     assert(results.length === 7);
//   });
//   it('of which 3 should not be null', () => {
//     assert(_.compact(results).length === 3);
//   });
//   it('aggregating results should give expected', () => {
//     const acc = _.map(_.compact(results), obj => _.keys(obj)[0]);
//     console.log('acc = ', acc);
//     const expected = ['c', 'e', 'g'];
//     assert(_.isEqual(acc, expected));
//   });
// });
//
// testing
//
// const throttled = throttle(a => a, {
// // const throttled = throttleP(a => delay(20).then(() => a), {
//   wait: 1000
// });
//
// const loop = (num, max) => {
//   throttled(num)
//     .then(res => {
//       console.log('loop ' + num + ' res = ', res);
//     })
//     .catch(err => {
//       console.log('err = ', err.message);
//     });
//   const next = num + 1;
//   if (next < max) {
//     delay(400)
//       .then(() => {
//         loop(next, max);
//       });
//   }
// };
//
// loop(0, 4)
