'use strict';

describe('Testing promise aggregator', () => {

  describe('Options Tests', () => {
    require('./options-tests');
  });

  describe('Timing tests', () => {
    require('./timing-tests');
  });

  after(() => {
    console.log('\nAll tests done:', new Date(), '\n');
  });
});
