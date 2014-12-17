var sublevel = require('level-sublevel')
var inflect = require('inflect')
var debug = require('debug')('level-rest')

function LevelREST(db, options) {
  if (!(this instanceof LevelREST)) return new LevelREST(db, options)
  this.db = sublevel(db)
  options = options || {}
  this.id = options.id || 'id'
  this.metaKey = options.metaKey || 'meta'
  this.serialize = options.serialize || function(url) {
    url = url.split('/')
    if (url[1] === 'undefined') url[1] = null
    var singular = inflect.singularize(url[0])
    return { api: url[0], id: url[1] || null, singular: singular }
  }
  this.generateId = options.generateId || function() {
    return +Date.now()
  }.bind(this)
}
module.exports = LevelREST

// Get data from an endpoint, ie: GET posts, GET posts/123
LevelREST.prototype.get = function(api, params) {
  var self = this
  api = this.serialize(api)
  var db = this.db.sublevel(api.api)

  var stream
  if (api.id) {
    debug('get one', api)
    stream = db.createValueStream({ start: api.id, limit: 1 })
  } else {
    debug('get all', api)
    stream = db.createValueStream()
  }

  return stream
}

// Put data into an endpoint, ie: PUT posts/123
LevelREST.prototype.put = function(api, data, params, cb) {
  if (typeof params === 'function') {
    cb = params
    params = {}
  }
  api = this.serialize(api)
  var db = this.db.sublevel(api.api)
  debug('put', api, data, params)
  db.put(api.id, data, params, cb)
}

// Create a new record on an endpoint, ie: POST posts/
LevelREST.prototype.post = function(api, data, params, cb) {
  if (typeof params === 'function') {
    cb = params
    params = {}
  }
  api = this.serialize(api)
  var db = this.db.sublevel(api.api)
  var id = data[this.id] || this.generateId()
  debug('post', api, id, data, params)
  db.put(id, data, params, cb)
}

// Delete a record on an endpoint, ie: DELETE posts/123
LevelREST.prototype.delete = function(api, params, cb) {
  if (typeof params === 'function') {
    cb = params
    params = {}
  }
  api = this.serialize(api)
  var db = this.db.sublevel(api.api)
  debug('delete', api, params)
  db.del(api.id, params, cb)
}
