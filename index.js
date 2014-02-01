var sublevel = require('level-sublevel')
var through = require('through')
var inflect = require('inflect')
var extend = require('extend')
var map = require('map-stream')

function LevelREST(db, options) {
  if (!(this instanceof LevelREST)) return new LevelREST(db, options)
  this.db = sublevel(db)
  options = options || {}
  this.id = options.id || 'id'
  this.separator = options.separator || ':'
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
    stream = db.createReadStream({ start: api.id, limit: 1 })
  } else {
    stream = db.createReadStream()
  }

  var out = through()
  var data = []
  stream.on('data', function(d) {
    data.push(d.value)
  }).on('close', function() {
    var outdata = {}
    if (api.id) {
      outdata[api.singular] = data.shift()
    } else {
      outdata[api.api] = data
    }
    outdata['meta'] = {}
    out.write(outdata)
    out.end()
  })

  return out
}

// Put data into an endpoint, ie: PUT posts/123
LevelREST.prototype.put = function(api, data, params, cb) {
  var self = this
  if (typeof params === 'function') {
    cb = params
    params = {}
  }
  api = this.serialize(api)
  var db = this.db.sublevel(api.api)
  var stream = through(function(d) {
    if (!api.id) return this.emit('error', new Error('Must supply a ' + self.id))
    var queue = this.queue
    if (typeof d[api.singular] === 'object') d = d[api.singular]
    db.get(api.id, function(err, olddata) {
      extend(olddata, d)
      db.put(api.id, olddata, function() {
        queue(d)
        stream.resume()
        if (typeof cb === 'function') stream.end()
      })
    })
  }, function() {
    this.queue(null)
    if (typeof cb === 'function') cb()
  })
  stream.pause()
  if (typeof cb === 'function') stream.write(data)
  return stream
}

// Create a new record on an endpoint, ie: POST posts/
LevelREST.prototype.post = function(api, data, params, cb) {
  var self = this
  if (typeof params === 'function') {
    cb = params
    params = {}
  }
  api = this.serialize(api)
  var db = this.db.sublevel(api.api)
  var stream = through(function(d) {
    var queue = this.queue
    if (typeof d[api.singular] === 'object') d = d[api.singular]
    var id = d[self.id] || self.generateId()
    db.put(id, d, function() {
      queue(d)
      stream.resume()
      if (typeof cb === 'function') stream.end()
    })
  }, function() {
    this.queue(null)
    if (typeof cb === 'function') cb()
  })
  stream.pause()
  if (typeof cb === 'function') stream.write(data)
  return stream
}

// Delete a record on an endpoint, ie: DELETE posts/123
LevelREST.prototype.delete = function(api, params, cb) {
  var self = this
  if (typeof params === 'function') {
    cb = params
    params = {}
  }
  api = this.serialize(api)
  var db = this.db.sublevel(api.api)
  db.del(api.id, cb)
  return this
}
