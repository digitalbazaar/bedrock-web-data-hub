/*!
 * Copyright (c) 2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

import axios from 'axios';

const headers = {Accept: 'application/ld+json, application/json'};

export class DataHubService {
  constructor({
    urls = {
      base: '/data-hubs'
    }
  } = {}) {
    this.config = {urls};
  }

  /**
   * @method create
   * @param {Object} options
   * @param {string} options.baseUrl - the base baseUrl
   * @param {string} options.config - the data hub's configuration
   * @description returns the configuration for the newly created data hub.
   */
  async create({url = this.config.urls.base, config}) {
    const response = await axios.post(url, config, {headers});
    return response.data;
  }

  /**
   * @method get
   * @param {Object} options
   * @param {string} options.baseUrl - the base baseUrl
   * @param {string} options.id - the data hub's ID
   * @description returns a data hub (represented by its configuration).
   */
  async get({baseUrl = this.config.urls.base, id}) {
    const response = await axios.get(baseUrl + '/' + id, {headers});
    return response.data;
  }

  /**
   * @method get
   * @param {Object} options
   * @param {string} options.baseUrl - the base baseUrl
   * @param {string} options.controller - the ID of the controller
   * @description returns a controller's primary data hub.
   */
  async getPrimary({baseUrl = this.config.urls.base, controller}) {
    const {data} = await this.getAll({baseUrl, controller, primary: true});
    return data[0] || null;
  }

  /**
   * @method getAll
   * @param {Object} options
   * @param {string} options.baseUrl - the base baseUrl
   * @param {string} options.controller - the data hub's controller
   * @param {string} options.primary - true to return primary data hubs.
   * @param {string} options.after - a data hub's ID
   * @param {number} options.limit - how many data hub configs to return
   * @return {Array} data
   * @description returns all data hubs (represented by their configuration
   *   documents) that match the given query parameters.
   */
  async getAll(
    {baseUrl = this.config.urls.base, controller, primary, after, limit}) {
    const response = await axios.get(baseUrl, {
      params: {controller, primary, after, limit}, headers});
    return response.data;
  }

  /**
   * @method update
   * @param {Object} options
   * @param {string} options.baseUrl
   * @param {string} options.id - an data hub's id
   * @param {number} options.sequence - a data hub config's sequence number
   * @param {Array<Object>} options.patch - a JSON patch per RFC6902
   * @return {Void}
   * @description updates an data hub config via a json patch as specified by:
   * [json patch format]{@link https://tools.ietf.org/html/rfc6902}
   * [we use fast-json]{@link https://www.npmjs.com/package/fast-json-patch}
   * to apply json patches.
   */
  async update({baseUrl = this.config.urls.base, id, sequence, patch}) {
    const patchHeaders = {'Content-Type': 'application/json-patch+json'};
    await axios.patch(
      `${baseUrl}/${id}`, {sequence, patch}, {headers: patchHeaders});
  }

  /**
   * @method setStatus
   * @param {Object} options
   * @param {string} options.baseUrl
   * @param {string} options.id - a data hub id
   * @param {string} options.status - a string that is either active or deleted
   * @return {Void}
   * @description changes a data hub's status to the given status.
  */
  async setStatus({baseUrl = this.config.urls.base, id, status}) {
    // FIXME: add ability to disable data hub access or to revoke all ocaps
    // that were delegated prior to a date of X.
    await axios.post(`${baseUrl}/${id}/status`, {status}, {headers});
  }
}
