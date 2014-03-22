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

  // Attach hasMany method
  out.hasMany = function(model) {
    // TODO: Build this
    //self.db.sublevel(model)
    console.log(model)
    return this
  }

  // Attach belongsTo method
  out.belongsTo = function(model) {
    var singular = inflect.singularize(model)
    var key = singular + '_id'
    var db = self.db.sublevel(model)
    return out.pipe(map(function(data, cb) {
      if (api.id) {
        // belongsTo with one
        data[singular] = {}
        if (!data[api.singular][key]) return cb(null, data)
        db.get(data[api.singular][key], function(err, d) {
          if (err) return cb(null, data)
          data[singular] = d
          cb(null, data)
        })
      } else {
        // belongsTo with many
        var len = data[api.api].length
        function done() { len--; if (len < 1) cb(null, data) }
        data[api.api].forEach(function(item, i) {
          var foreignKey = data[api.api][i][key]
          db.get(foreignKey, function(err, d) {
            data[api.api][i][singular] = d || {}
            done()
          })
        })
      }
    }))
  }

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
  var buffer = []
  var stream = through(function(d) {
    buffer.push(d)
  }, function() {
    var len = buffer.length
    var queue = this.queue
    // TODO: Needs correct response
    var res = { meta: { success: true } }
    function done() {
      len--
      if (len < 1) {
        queue(res)
        queue(null)
        if (typeof cb === 'function') cb(null, res)
      }
    }
    for (var i = 0; i < buffer.length; i++) {
      var d = buffer[i]
      if (typeof d[api.singular] === 'object') d = d[api.singular]
      db.get(api.id, function(err, olddata) {
        extend(olddata, d)
        db.put(api.id, olddata, done)
      })
    }
  })
  if (!api.id) return stream.emit('error', new Error('Must supply a ' + this.id))
  if (typeof cb === 'function') {
    stream.write(data)
    stream.end()
  }
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
  var buffer = []
  var stream = through(function(d) {
    if (typeof d[api.singular] === 'object') d = d[api.singular]
    var id = d[self.id] || self.generateId()
    buffer.push({ type: 'put', key: id, value: d })
  }, function() {
    var queue = this.queue
    db.batch(buffer, function(err) {
      // TODO: Needs correct response
      var res = { meta: { success: true } }
      queue(res)
      queue(null)
      if (typeof cb === 'function') cb(null, res)
    })
  })
  if (typeof cb === 'function') {
    stream.write(data)
    stream.end()
  }
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
  var buffer = []
  var stream = through(function(d) {
    var id = (typeof d !== 'object') ? d : (d[self.id]) ? d[self.id] : api.id
    buffer.push({ type: 'del', key: id })
  }, function() {
    var queue = this.queue
    db.batch(buffer, function(err) {
      // TODO: Needs correct response
      var res = { meta: { success: true } }
      queue(res)
      queue(null)
      if (typeof cb === 'function') cb(null, res)
    })
  })
  if (typeof cb === 'function') {
    stream.write(api.id)
    stream.end()
  }
  return stream
}
