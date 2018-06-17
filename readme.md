# promise-aggregate

promise-aggregate, given an input function `fn` (regular or promise) that is expensive or otherwise needs to be managed, helps control how often `fn` actually executes.

This is essentially a variant of debounce, with some additional configurable elements. [debounce-promise](https://www.npmjs.com/package/debounce-promise) for example works very similarly, is slightly less complex, but is not as configurable.

## install
```
$ npm install promise-aggregate
```

## usage
```js
const aggregate = require('promise-aggregate');
// and the function (promise or otherwise)
// that we want to manage
const fn = async a => a;
const options = {
  mode: 'NULL' // 'NULL' is default
  minInterval: 200, // all times in ms
  aggInterval: 100,
  maxWait: 400
};
const aggFn = aggregate(fn, options);

// the actual options being used can be accessed:
const activeOptions = aggFn.options;

// just as an example
const loop = count => {
  const res = await aggFn(count);
  if (!res) {
    console.log('This one got skipped');
  } else {
    console.log(res + ' was returned');
  }
  if (count < 50) {
    setTimeout(
      () => loop(count + 1),
      100 * Math.random()
    );
  }
};
loop(1);
```
>Note: `fn` and `aggFn` will be referred to below

## API

>where `aggregate = require('promise-aggregate')`

## aggregate(fn, [options])
Wraps `fn` in an aggregator (i.e. `aggFn`). Any options parameters supplied will override defaultOptions. The resulting options object is (at present at least) validated to not have silly values. Validation will probably disappear however. Silly in, silly out. Usage as above.

### aggregate.modes
exposes the allowed mode types (which determines what happens when execution of the input function is frustrated)
```js
{
  NULL: 'NULL', // default
  ERROR: 'ERROR',
  REPEAT: 'REPEAT'
}
```
###### NULL
`aggFn` resolves `null`
###### ERROR
`aggFn` rejects an Error
###### REPEAT
`aggFn` will eventually resolve the result of the next function execution (many promises may potentially appear to resolve at once)

### aggregate.defaultOptions
exposes the default options. Warning: mutating this object WILL affect aggregated functions created post mutation.
```js
{
  mode: 'NULL',
  minInterval: 300, // ms
  maxWait: 300,     // ms
  aggInterval: 0,   // ms
  replaceArgs: (args, prev) => args // raw replacement
}
```
###### minInterval
The minimum amount of time allowed between two consecutive `fn` executions (finite positive number)
###### aggInterval
Once `aggFn` is called, execution will be delayed by `aggInterval`, attempting to aggregate additional execution calls. (finite positive number)
###### maxWait
Since using `aggInterval` repeatedly can hypothetically delay `fn` execution indeterminately, `maxWait` is set as the maximum amount of time allowed between the 'first' execution call and the next actual execution. (positive number, `> minInterval`, infinity IS allowed)
###### replaceArgs
The function that dictates how to aggregate `fn` arguments. The default behavior is that the latest arguments `aggFn` replaces any 'unused' old arguments [Some examples below](## Using replaceArgs)

### aggFn.options
The **actual** options object that aggFn is operating with. **Warning:** mutations done to this object WILL be effective immediately

## Using replaceArgs
Some examples of what replaceArgs can look like:
```js
const objReplace = (args, prev) => {
  const obj = args[0];
  return Object.assign({}, prev, obj);
};

const arrReplace = (args, prev) => {
  return (prev || []).concat(args);
};
```
