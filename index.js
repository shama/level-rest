var sublevel = require('level-sublevel')
var through = require('through')
var inflect = require('inflect')
var extend = require('extend')

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
    return { api: url[0], id: url[1] || null }
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
      var singular = inflect.singularize(api.api)
      outdata[singular] = data.shift()
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
  if (!api.id) return cb(new Error('Must supply a ' + this.id))
  var db = this.db.sublevel(api.api)
  db.get(api.id, function(err, olddata) {
    extend(olddata, data)
    db.put(api.id, olddata, cb)
  })
  return this
}

// Create a new record on an endpoint, ie: POST posts/
LevelREST.prototype.post = function(api, data, params, cb) {
  var self = this
  if (typeof params === 'function') {
    cb = params
    params = {}
  }
  api = this.serialize(api)
  var id = data[this.id] || this.generateId()
  var db = this.db.sublevel(api.api)
  db.put(id, data, cb)
  return this
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
