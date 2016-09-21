'use strict';


/**
 * @module
 * @copyright paywell Team at byteskode <www.byteskode.com>
 * @description virtual wallet for paywell
 * @since 0.1.0
 * @author lally elias<lallyelias87@gmail.com, lally.elias@byteskode.com>
 * @singleton
 * @public
 */

//TODO make use of event emitter

//dependencies
const _ = require('lodash');
const async = require('async');
const redis = require('paywell-redis');
const phone = require('phone');
const uuid = require('uuid');

//default receipt options
const defaults = {
  prefix: 'paywell',
  redis: {},
  collection: 'wallets',
  queue: 'wallets',
  country: 'TZ'
};


/**
 * @name defaults
 * @description default options/settings
 * @type {Object}
 * @private
 * @since 0.1.0
 */
exports.defaults = _.merge({}, defaults);


/**
 * @function
 * @name init
 * @description initialize receipt internals
 * @since 0.1.0
 * @public
 */
exports.init = function () {

  //initialize redis client
  if (!exports.redis) {
    exports.redis = redis(exports.defaults);
  }

};


/**
 * @function
 * @name toE164
 * @description convert phone number to E.164 format
 * @param  {String} phoneNumber valid phone number
 * @param  {Object} [options] convertion options
 * @param  {String} [options.country] valid alpha2 country code. default to
 *                                    TZS(Tanzania)
 * @return {String}             phone number in E.164 format or null
 * @since 0.1.0
 * @public
 * @see {@link https://en.wikipedia.org/wiki/E.164|E.164}
 */
exports.toE164 = function (phoneNumber, options, done) {
  //normalize arguments
  if (options && _.isFunction(options)) {
    done = options;
    options = {};
  }

  //ensure options
  options = _.merge({}, {
    country: exports.defaults.country
  }, options);

  //convert number to E.164
  try {
    const parts = phone(phoneNumber, options.country);
    const isValidPhoneNumber = !parts || parts.length !== 0;

    //return number
    if (isValidPhoneNumber) {
      done(null, parts[0]);
    }

    //throw exception
    else {
      let error = new Error('Invalid Phone Number ' + phoneNumber);
      error.status = 400;
      done(error);
    }
  } catch (error) {
    done(error);
  }

};


/**
 * @function
 * @name key
 * @description generate wallet redis storage key
 * @param  {String} phoneNumber valid phone number
 * @return {String}             wallet redis storage key or null
 * @since 0.1.0
 * @public
 */
exports.key = function (phoneNumber, done) {
  async.waterfall([

    function toE164(next) {
      exports.toE164(phoneNumber, next);
    },

    function generateWalletKey(_phoneNumber, next) {
      //replace leading + in e.164 phone number
      _phoneNumber = _phoneNumber.replace('+', '');
      //generate redis storage key
      const key = exports.redis.key(
        exports.defaults.collection,
        _phoneNumber
      );
      next(null, key);
    }
  ], function (error, _phoneNumber) {
    done(error, _phoneNumber);
  });
};


/**
 * @function
 * @name get
 * @description get wallet(s)
 * @param  {String,String[]}   phoneNumber valid wallet phone number(s)
 * @param  {Function} done a callback to invoke on success or failure
 * @return {Object|Object[]}        collection or single wallets
 * @since 0.1.0
 * @public
 */
exports.get = function (phoneNumber, done) {

  //get specific wallet(s)
  const client = exports.redis;
  client.hash.get(phoneNumber, function (error, wallets) {
    //process wallet collection
    if (_.isArray(wallets)) {
      //deserialize dates
      wallets = _.map(wallets, function (wallet) {
        wallet = _.merge({}, wallet, {
          createdAt: Date(wallet.createdAt),
          updatedAt: Date(wallet.updatedAt),
          deletedAt: Date(wallet.deletedAt)
        });
        return wallet;
      });
    }

    //process single wallet
    else {
      //deserialize dates
      wallets = _.merge({}, wallets, {
        createdAt: Date(wallets.createdAt),
        updatedAt: Date(wallets.updatedAt),
        deletedAt: Date(wallets.deletedAt)
      });
    }

    done(error, wallets);
  });

};


/**
 * @function
 * @name save
 * @description persist a given receipt into redis
 * @param  {Object}   receipt valid paywell receipt
 * @param  {Function} done    a callback to invoke on success or failure
 * @return {Object|Error}           valid paywell receipt or error
 * @since 0.1.0
 * @public
 */
exports.save = exports.create = function (receipt, done) {

  //ensure receipt
  receipt = _.merge({}, {
    uuid: uuid.v1()
  }, receipt);

  //prepare save options
  const options = {
    collection: exports.defaults.collection,
    index: true,
    ignore: ['_id', 'payload']
  };

  const client = exports.redis;

  //set it
  receipt._id = client.key([options.collection, receipt.uuid]);

  //save receipt
  client.hash.save(receipt, options, function (error, _receipt) {
    _receipt.receivedAt = new Date(_receipt.receivedAt);
    done(error, _receipt);
  });

};


/**
 * @function
 * @name search
 * @description free text search receipt(s)
 * @param  {String}   query a search string
 * @param  {Function} done  a callback to invoke on success or failure
 * @return {Object[]}         collection of paywell receipt(s) or error
 */
exports.search = function (query, done) {

  //prepare search options
  const options = {
    collection: exports.defaults.collection,
    q: query
  };

  //search receipts
  const client = exports.redis;
  client.hash.search(options, function (error, receipts) {
    done(error, receipts);
  });

};


/**
 * @function
 * @name get
 * @description get receipt(s)
 * @param  {String,String[]}   keys valid receipt(s) key(s)
 * @param  {Function} done a callback to invoke on success or failure
 * @return {Object|Object[]}        collection or single receipt
 * @since 0.1.0
 * @public
 */
exports.get = function (keys, done) {

  //get specific receipt(s)
  const client = exports.redis;
  client.hash.get(keys, function (error, receipts) {
    //process receipt collection
    if (_.isArray(receipts)) {
      //map receivedAt to date
      receipts = _.map(receipts, function (receipt) {
        receipt = _.merge({}, receipt, {
          receivedAt: Date(receipt.receivedAt)
        });
        return receipt;
      });
    }

    //process single receipt
    else {
      receipts = _.merge({}, receipts, {
        receivedAt: Date(receipts.receivedAt)
      });
    }

    done(error, receipts);
  });

};

exports.getPin = function (phoneNumber, done) {
  //TODO implement
  done();
};

exports.generatePaycode = function (phoneNumber, done) {
  // TODO implement
  done();
};