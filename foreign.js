var inflect = require('inflect')
var map = require('map-stream')

module.exports.hasMany = function(out, model) {
  // TODO: Build this
  //self.db.sublevel(model)
  console.log(model)
  return this
}

module.exports.belongsTo = function(opts) {
  var model = opts.model
  var api = opts.api
  var db = opts.db
  var singular = inflect.singularize(model)
  var key = singular + '_id'
  return map(function(data, cb) {
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
  })
}  

